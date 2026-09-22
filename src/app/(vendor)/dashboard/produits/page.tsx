import Link from "next/link";
import { ViewTransition } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleShop } from "@/lib/shop-access";
import { ProductList } from "./product-list";
import { ProductFilters, type ProductFiltersValue } from "./product-filters";

const PAGE_SIZE = 50;

type Product = {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  price: number;
  stock: number;
  stock_alert_threshold: number | null;
  is_active: boolean;
  product_images: { url: string; position: number }[];
};

const SORTS: Record<string, { column: string; ascending: boolean }> = {
  "": { column: "created_at", ascending: false },
  prix_asc: { column: "price", ascending: true },
  prix_desc: { column: "price", ascending: false },
  stock_asc: { column: "stock", ascending: true },
  nom_asc: { column: "title", ascending: true },
};

// Gestion des produits du vendeur connecté (ajout, modif, suppression, stock).
// cf. cahier des charges §3.1.A.3.
//
// Rendu de la liste délégué à <ProductList> (Client Component) depuis le
// 15/09/2026 : sélection multiple + actions groupées (bulkToggleActive)
// nécessitent un état local (cases à cocher), impossible dans un Server
// Component. Cette page reste serveur pour la récupération des données et
// pour le filtrage/tri (recherche, catégorie, statut, tri), lus depuis l'URL
// (`searchParams`) plutôt qu'un state client, afin de rester partageable et
// actualisable par simple lien.
//
// Refonte visuelle du 15/09/2026, sur inspiration d'une maquette envoyée par
// le designer UX/UI d'Isaac (filtres, tri, bascule tableau/grille), adaptée
// aux couleurs/typo KEVA — voir aussi dashboard/layout.tsx et
// produits/product-list.tsx pour le reste de cette refonte.
//
// **Pagination ajoutée le 22/09/2026** (audit "filtres partout" d'Isaac) :
// les filtres existaient déjà, mais la requête n'était jamais bornée — un
// catalogue de plusieurs centaines de produits se chargeait entièrement à
// chaque visite. Même pattern 50/page que les autres pages de ce lot.
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categorie?: string; statut?: string; tri?: string; page?: string }>;
}) {
  const { q = "", categorie = "", statut = "", tri = "", page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Produits/Commandes/Aperçu sont accessibles à un collaborateur actif, pas
  // seulement au propriétaire (plan Pro, `can_multi_user`, ajouté le
  // 16/09/2026 — voir src/lib/shop-access.ts pour le périmètre exact).
  const access = user ? await getAccessibleShop(supabase, user.id) : null;

  if (!access) {
    redirect("/dashboard/boutique");
  }

  let query = supabase
    .from("products")
    .select(
      "id, slug, title, category, price, stock, stock_alert_threshold, is_active, product_images(url, position)",
      { count: "exact" }
    )
    .eq("shop_id", access.shopId)
    .is("deleted_at", null);

  if (q) query = query.ilike("title", `%${q}%`);
  if (categorie) query = query.eq("category", categorie);
  if (statut === "actif") query = query.eq("is_active", true);
  if (statut === "inactif") query = query.eq("is_active", false);

  const sort = SORTS[tri] ?? SORTS[""];
  query = query.order(sort.column, { ascending: sort.ascending }).range(from, to);

  const { data: products, count } = await query;
  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  const currentFilters: ProductFiltersValue = { q, categorie, statut, tri };

  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
    <ViewTransition enter="kv-content-in" default="none">
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-lg font-semibold text-encre">Mes produits</h1>
        <Link
          href="/dashboard/produits/nouveau"
          transitionTypes={["nav-forward"]}
          className="flex items-center gap-1.5 rounded-md bg-vert-actif px-3 py-1.5 text-sm font-medium text-white hover:bg-vert-actif/90"
        >
          <IconPlus className="h-4 w-4" />
          Ajouter un produit
        </Link>
      </div>

      <ProductFilters current={currentFilters} />

      <ProductList products={(products as Product[]) ?? []} />

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm">
          {page > 1 ? (
            <Link
              href={`/dashboard/produits?${new URLSearchParams({ ...(q ? { q } : {}), ...(categorie ? { categorie } : {}), ...(statut ? { statut } : {}), ...(tri ? { tri } : {}), page: String(page - 1) })}`}
              className="rounded-md border border-ligne px-3 py-1.5 text-encre transition hover:border-vert-actif"
            >
              ‹ Précédent
            </Link>
          ) : (
            <span className="rounded-md border border-ligne px-3 py-1.5 text-encre/30">‹ Précédent</span>
          )}
          <span className="px-2 font-mono text-encre/70">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={`/dashboard/produits?${new URLSearchParams({ ...(q ? { q } : {}), ...(categorie ? { categorie } : {}), ...(statut ? { statut } : {}), ...(tri ? { tri } : {}), page: String(page + 1) })}`}
              className="rounded-md border border-ligne px-3 py-1.5 text-encre transition hover:border-vert-actif"
            >
              Suivant ›
            </Link>
          ) : (
            <span className="rounded-md border border-ligne px-3 py-1.5 text-encre/30">Suivant ›</span>
          )}
        </div>
      )}
    </div>
    </ViewTransition>
    </ViewTransition>
  );
}

function IconPlus(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
