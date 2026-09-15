import Link from "next/link";
import { ProductCard, type MarketplaceCardProduct } from "@/components/product-card";

/**
 * Bande de produits à défilement horizontal — extraite le 15/09/2026 (round
 * 2 de la refonte de la page d'accueil marketplace) en même temps que le
 * passage d'un unique "Tout le catalogue" paginé à une disposition façon
 * Jumia/Amazon : une bande par catégorie, plus "Nouveautés" et "Meilleures
 * ventes". Le markup (scroll à ancrage, largeur de carte, titre + lien "voir
 * tout") était déjà dupliqué trois fois dans `page.tsx` avant cette
 * extraction (Nouveautés, et bientôt Meilleures ventes + une bande par
 * catégorie) — un seul composant partagé plutôt que de dupliquer une
 * quatrième puis une vingtaine de fois.
 *
 * Rend `null` si la liste est vide : chaque bande reste responsable de
 * masquer sa propre section (cohérent avec le principe déjà en place pour
 * "Nouveautés"/"Boutiques de la plateforme" — jamais de bande vide affichée
 * "en dur").
 */
export function ProductRow({
  title,
  products,
  viewAllHref,
  viewAllLabel = "Voir tout",
}: {
  title: string;
  products: MarketplaceCardProduct[];
  viewAllHref?: string;
  viewAllLabel?: string;
}) {
  if (products.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-encre">{title}</h2>
        {viewAllHref ? (
          <Link href={viewAllHref} className="shrink-0 text-sm font-medium text-vert-actif hover:underline">
            {viewAllLabel} ›
          </Link>
        ) : null}
      </div>
      <div className="-mx-4 mt-3 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 scroll-smooth">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} className="w-44 shrink-0 snap-start" />
        ))}
      </div>
    </section>
  );
}
