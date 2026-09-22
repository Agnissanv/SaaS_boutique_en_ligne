import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES } from "@/lib/categories";
import { CategoryIcon } from "@/components/category-icon";
import { ProductImage } from "@/components/product-image";
import { buildMarketplaceHref } from "@/lib/marketplace/filters";

export const metadata: Metadata = {
  title: "Toutes les catégories — KEVA",
  description:
    "Parcours tout le catalogue KEVA par catégorie — mode, électronique, maison, beauté et plus, tous vendeurs confondus.",
};

// Même compromis que `CATEGORY_FEED_LIMIT` dans src/app/page.tsx : un flux
// borné des produits les plus récents pour choisir une vignette par
// catégorie, plutôt qu'une requête par catégorie (jusqu'à 24).
const THUMBNAIL_FEED_LIMIT = 400;

type RawProduct = {
  category: string | null;
  product_images: { url: string; position: number }[];
};

/**
 * Page dédiée "Toutes les catégories" — ajoutée le 16/09/2026, à la demande
 * d'Isaac ("le bouton catégories doit avoir une page dédiée bien garnie,
 * comme sur Jumia"). Jusqu'ici, le bouton "Catégories" de la barre de
 * navigation basse (bottom-nav.tsx) ne faisait que scroller vers la bande de
 * catégories de la page d'accueil (`#categories`) — pas de page à part.
 *
 * Route top-niveau (`/categories`), pas sous `(public)/[shopSlug]` : cette
 * page n'appartient à aucune boutique, elle liste tout le catalogue de la
 * plateforme, comme la marketplace elle-même (`src/app/page.tsx`, également
 * hors du groupe `(public)`).
 *
 * Ne montre que les catégories ayant au moins un produit actif — même
 * principe que `availableCategories` sur la page d'accueil marketplace,
 * pour ne jamais mener vers un rayon vide. Chaque tuile affiche une vraie
 * photo produit (jamais une image de stock) et le nombre réel d'articles.
 */
export default async function CategoriesPage() {
  const supabase = await createClient();

  // Comptage exact par catégorie — une seule colonne utile, sans limite : au
  // vu du volume actuel de la plateforme le coût reste négligeable (même
  // raisonnement que pour `availableCategories` dans src/app/page.tsx).
  const countsQuery = supabase
    .from("products")
    .select("category, shop:shops!inner(status)")
    .eq("is_active", true)
    .is("deleted_at", null)
    .eq("shop.status", "active")
    .not("category", "is", null);

  // Vignette représentative par catégorie — flux borné le plus récent.
  const thumbnailsQuery = supabase
    .from("products")
    .select("category, product_images(url, position), shop:shops!inner(status)")
    .eq("is_active", true)
    .is("deleted_at", null)
    .eq("shop.status", "active")
    .not("category", "is", null)
    .order("created_at", { ascending: false })
    .limit(THUMBNAIL_FEED_LIMIT);

  const [{ data: countsRaw }, { data: thumbsRaw }] = await Promise.all([
    countsQuery,
    thumbnailsQuery,
  ]);

  const counts = new Map<string, number>();
  for (const row of (countsRaw ?? []) as { category: string | null }[]) {
    if (!row.category) continue;
    counts.set(row.category, (counts.get(row.category) ?? 0) + 1);
  }

  const thumbnails = new Map<string, string>();
  for (const row of (thumbsRaw ?? []) as RawProduct[]) {
    if (!row.category || thumbnails.has(row.category)) continue;
    const url = [...(row.product_images ?? [])].sort((a, b) => a.position - b.position)[0]?.url;
    if (url) thumbnails.set(row.category, url);
  }

  const categoriesWithProducts = CATEGORIES.filter((c) => (counts.get(c.value) ?? 0) > 0);

  return (
    <main className="w-full mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="mb-1 flex items-center gap-2 text-xs">
        <Link href="/" className="text-vert-actif underline">
          Accueil
        </Link>
        <span className="text-encre/40">/</span>
        <span className="text-encre/70">Catégories</span>
      </div>
      <h1 className="font-display text-2xl font-semibold text-encre sm:text-3xl">
        Toutes les catégories
      </h1>
      <p className="mt-1 text-sm text-encre/70">
        {categoriesWithProducts.length === 0
          ? "Aucun produit disponible pour l'instant — reviens bientôt."
          : `${categoriesWithProducts.length} catégorie${categoriesWithProducts.length === 1 ? "" : "s"} avec des produits disponibles, tous vendeurs confondus.`}
      </p>

      {categoriesWithProducts.length > 0 ? (
        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {categoriesWithProducts.map((cat) => {
            const thumbnail = thumbnails.get(cat.value);
            const count = counts.get(cat.value) ?? 0;
            return (
              <Link
                key={cat.value}
                href={`${buildMarketplaceHref({}, { categorie: cat.value })}#catalogue`}
                className="group flex flex-col overflow-hidden rounded-lg border border-ligne bg-white transition-all duration-150 hover:-translate-y-0.5 hover:border-vert-actif hover:shadow-md"
              >
                <div className="relative aspect-square w-full bg-brume">
                  {thumbnail ? (
                    <ProductImage src={thumbnail} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-vert-actif">
                      <CategoryIcon value={cat.value} className="h-8 w-8" />
                    </div>
                  )}
                  <span className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-vert-actif shadow-sm">
                    <CategoryIcon value={cat.value} className="h-4 w-4" />
                  </span>
                </div>
                <div className="p-2.5">
                  <p className="line-clamp-1 text-sm font-medium text-encre group-hover:text-vert-sapin">
                    {cat.label}
                  </p>
                  <p className="text-xs text-encre/50">
                    {count} article{count === 1 ? "" : "s"}
                  </p>
                </div>
              </Link>
            );
          })}
        </section>
      ) : null}
    </main>
  );
}
