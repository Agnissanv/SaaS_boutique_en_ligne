import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEffectivePrice } from "@/lib/products";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { categoryLabel } from "@/lib/categories";
import { loadSearchDocs } from "@/lib/search/catalog";
import { searchDocs } from "@/lib/search/engine";
import { orderByIds } from "@/lib/search/results";
import { normalizeText } from "@/lib/search/text";

/**
 * Suggestions de recherche marketplace (autocomplete) — ajouté le 21/09/2026,
 * item du "plus tard" du cahier des charges le plus autonome à construire
 * pendant la pause CinetPay (ne dépend d'aucun paiement).
 *
 * Répond à la fois avec des produits (titre) ET des boutiques (nom) — ce qui
 * règle au passage un point resté "pas encore décidé" dans
 * decisions-techniques.md ("si la recherche marketplace doit un jour couvrir
 * le nom de la boutique") : la recherche texte classique reste limitée au
 * titre produit (changement plus risqué, hors périmètre ici), mais
 * l'autocomplete peut sans risque proposer directement une boutique dont le
 * nom correspond, en plus des produits.
 *
 * 09/10/2026 : produits trouvés par le moteur de recherche de la page de
 * résultats (src/lib/search/engine.ts) plutôt que par `ilike` sur le titre
 * — mêmes résultats en suggestion et après « Rechercher », accents et
 * fautes de frappe compris — et rayons proposés (« ordinateur » ->
 * Informatique). Boutiques comparées sans accents ni majuscules.
 *
 * Route publique (client anonyme, mêmes policies RLS que la page d'accueil
 * marketplace) — pas d'authentification requise, cohérent avec le fait que
 * la marketplace elle-même est publique.
 */

const MIN_QUERY_LENGTH = 2;
const PRODUCT_SUGGESTIONS_LIMIT = 6;
const SHOP_SUGGESTIONS_LIMIT = 3;
const CATEGORY_SUGGESTIONS_LIMIT = 2;
// Les boutiques sont comparées en mémoire (sans accents) : on en lit au plus
// ce nombre, triées par popularité.
const SHOP_SCAN_LIMIT = 2000;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ products: [], shops: [], categories: [] });
  }

  // 60 requêtes / minute par IP (28/09/2026, audit pré-lancement) — généreux
  // pour une frappe normale au clavier (une requête par lettre tapée), mais
  // empêche un script d'appeler cette route en boucle pour rien. Voir
  // src/lib/rate-limit.ts.
  const ip = getClientIp(request.headers);
  const allowed = await checkRateLimit("search_suggestions", ip, {
    maxAttempts: 60,
    windowMinutes: 1,
  });
  if (!allowed) {
    return NextResponse.json({ products: [], shops: [], categories: [] }, { status: 429 });
  }

  const supabase = await createClient();

  const [outcome, shopsResult] = await Promise.all([
    loadSearchDocs()
      .then((docs) => searchDocs(docs, q))
      .catch((error) => {
        console.error("Suggestions de recherche : catalogue indisponible", error);
        return null;
      }),
    supabase
      .from("shops")
      .select("slug, name")
      .eq("status", "active")
      .order("view_count", { ascending: false })
      .limit(SHOP_SCAN_LIMIT),
  ]);

  const productIds = (outcome?.results ?? [])
    .slice(0, PRODUCT_SUGGESTIONS_LIMIT)
    .map((r) => r.doc.id);
  const productsResult =
    productIds.length > 0
      ? await supabase
          .from("products")
          .select(
            "id, slug, title, price, sale_price, sale_starts_at, sale_ends_at, product_images(url, position), shop:shops!inner(slug, status)"
          )
          .in("id", productIds)
          .eq("is_active", true)
          .is("deleted_at", null)
          .eq("shop.status", "active")
      : { data: [] };

  type RawProduct = {
    id: string;
    slug: string;
    title: string;
    price: number;
    sale_price: number | null;
    sale_starts_at: string | null;
    sale_ends_at: string | null;
    product_images: { url: string; position: number }[];
    shop: { slug: string; status: string } | { slug: string; status: string }[] | null;
  };

  const products = orderByIds((productsResult.data as RawProduct[] | null) ?? [], productIds)
    .map((product) => {
      const shop = Array.isArray(product.shop) ? product.shop[0] : product.shop;
      if (!shop) return null;
      const thumbnail = [...(product.product_images ?? [])].sort(
        (a, b) => a.position - b.position
      )[0]?.url;
      // Prix effectif (soldé si une promo datée est active maintenant) —
      // corrigé le 22/09/2026 (audit pré-lancement) : cette route affichait
      // encore le prix plein pendant qu'une promo était active, alors que
      // toutes les autres surfaces (accueil, boutique, fiche produit)
      // utilisent déjà `getEffectivePrice` depuis la migration 0031.
      const effective = getEffectivePrice({
        price: product.price,
        compareAtPrice: null,
        salePrice: product.sale_price,
        saleStartsAt: product.sale_starts_at,
        saleEndsAt: product.sale_ends_at,
      });
      return {
        id: product.id,
        slug: product.slug,
        shopSlug: shop.slug,
        title: product.title,
        price: effective.price,
        thumbnail,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const needle = normalizeText(q);
  const shops = (shopsResult.data ?? [])
    .filter((shop) => needle && normalizeText(shop.name).includes(needle))
    .slice(0, SHOP_SUGGESTIONS_LIMIT)
    .map((shop) => ({ slug: shop.slug, name: shop.name }));

  // Rayons désignés par la requête ET réellement présents dans les résultats
  // (jamais un rayon vide).
  const resultCategories = new Set((outcome?.results ?? []).map((r) => r.doc.category));
  const categories = (outcome?.inferredCategories ?? [])
    .filter((value) => resultCategories.has(value))
    .slice(0, CATEGORY_SUGGESTIONS_LIMIT)
    .map((value) => ({ value, label: categoryLabel(value) }));

  return NextResponse.json({ products, shops, categories });
}
