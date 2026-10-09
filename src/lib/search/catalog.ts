import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { getAttributeValueLabel } from "@/lib/category-attributes";
import type { SearchDoc } from "./engine";

/**
 * Chargement du catalogue pour le moteur de recherche (09/10/2026).
 *
 * Lit les produits actifs (marketplace : boutiques actives uniquement ;
 * boutique : ses seuls produits) avec tout le texte utile à la recherche :
 * titre, description, tags, points forts, caractéristiques.
 *
 * Client Supabase ANONYME, sans cookie : seules les données publiques sont
 * lues, jamais celles qu'un vendeur connecté verrait en plus. C'est ce qui
 * permet de garder le résultat en mémoire et de le partager entre visiteurs
 * pendant `CACHE_TTL_MS` : une recherche (ou une suggestion pendant la
 * frappe) ne relit pas tout le catalogue à chaque fois. Un produit publié
 * apparaît donc dans la recherche au plus une minute plus tard.
 */

const BATCH_SIZE = 1000; // plafond de lignes par requête côté Supabase
const MAX_DOCS = 3000;
const DESCRIPTION_CHARS = 400;
const CACHE_TTL_MS = 60_000;

const SEARCH_COLUMNS =
  "id, title, description, tags, highlights, attributes, category, price, created_at, shop:shops!inner(name, status)";

type RawSearchRow = {
  id: string;
  title: string;
  description: string | null;
  tags: string[] | null;
  highlights: string[] | null;
  attributes: Record<string, string> | null;
  category: string | null;
  price: number;
  created_at: string;
  shop: { name: string } | { name: string }[] | null;
};

function toSearchDoc(row: RawSearchRow): SearchDoc {
  const shop = Array.isArray(row.shop) ? row.shop[0] : row.shop;
  const attributeText = Object.entries(row.attributes ?? {})
    .filter(([, value]) => typeof value === "string" && value)
    .map(([key, value]) => {
      const label = getAttributeValueLabel(row.category, key, value);
      return label === value ? value : `${value} ${label}`;
    });
  return {
    id: row.id,
    title: row.title,
    details: [
      (row.description ?? "").slice(0, DESCRIPTION_CHARS),
      ...(row.tags ?? []),
      ...(row.highlights ?? []),
      ...attributeText,
    ].join(" "),
    category: row.category,
    shopName: shop?.name ?? "",
    createdAt: row.created_at,
    price: Number(row.price),
    attributes: row.attributes,
  };
}

function publicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

async function fetchSearchDocs(shopId: string | undefined): Promise<SearchDoc[]> {
  const supabase = publicClient();
  const docs: SearchDoc[] = [];
  for (let from = 0; from < MAX_DOCS; from += BATCH_SIZE) {
    let query = supabase
      .from("products")
      .select(SEARCH_COLUMNS)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + BATCH_SIZE - 1);
    query = shopId ? query.eq("shop_id", shopId) : query.eq("shop.status", "active");
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as unknown as RawSearchRow[];
    docs.push(...rows.map(toSearchDoc));
    if (rows.length < BATCH_SIZE) break;
  }
  return docs;
}

const cache = new Map<string, { at: number; docs: Promise<SearchDoc[]> }>();

/** Produits recherchables de la marketplace, ou d'une seule boutique avec `shopId`. */
export function loadSearchDocs(options: { shopId?: string } = {}): Promise<SearchDoc[]> {
  const key = options.shopId ?? "*";
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.docs;

  const docs = fetchSearchDocs(options.shopId);
  cache.set(key, { at: Date.now(), docs });
  // Un échec ne doit pas rester en cache une minute : la recherche suivante réessaie.
  docs.catch(() => cache.delete(key));
  if (cache.size > 200) {
    for (const [k, v] of cache) if (Date.now() - v.at >= CACHE_TTL_MS) cache.delete(k);
  }
  return docs;
}
