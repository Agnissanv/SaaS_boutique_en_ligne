import Link from "next/link";
import { CategoryIcon } from "@/components/category-icon";
import { ProductImage } from "@/components/product-image";
import { HeroBannerCarousel, type HeroSlide } from "@/components/hero-banner-carousel";

export type HeroCategoryLink = { value: string; label: string; href: string };

export type HeroFeaturedProduct = {
  href: string;
  title: string;
  price: number;
  thumbnail?: string;
  shopName: string;
};

const MAX_SIDEBAR_CATEGORIES = 8;

/**
 * Hero "grande marketplace" (06/10/2026, demande d'Isaac — Jumia/Amazon) :
 * menu de catégories à gauche, grande bannière rotative au centre, deux cartes
 * à droite (appel aux vendeurs + un vrai produit mis en avant). Sous `lg`, le
 * menu disparaît (la bande `CategoryNav` juste en dessous prend le relais) et
 * les cartes passent sous la bannière sur deux colonnes.
 *
 * Aucune donnée inventée : les diapos, catégories et le produit viennent de la
 * base (voir `page.tsx`) ; une carte ou une diapo sans donnée n'est pas rendue.
 * Server Component — seule la bannière est un composant client.
 */
export function HeroMarketplace({
  slides,
  categories,
  featuredProduct,
}: {
  slides: HeroSlide[];
  categories: HeroCategoryLink[];
  featuredProduct: HeroFeaturedProduct | null;
}) {
  return (
    <section className="mx-auto w-full max-w-6xl px-3 pb-2 pt-3 sm:px-4">
      <div className="grid gap-3 lg:grid-cols-[14rem_minmax(0,1fr)_15rem]">
        {categories.length > 0 ? (
          <nav
            aria-label="Catégories populaires"
            className="hidden h-[24rem] flex-col overflow-hidden rounded-lg border border-ligne bg-white lg:flex"
          >
            <p className="border-b border-ligne px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-encre/60">
              Catégories
            </p>
            <ul className="flex-1 overflow-hidden py-1">
              {categories.slice(0, MAX_SIDEBAR_CATEGORIES).map((category) => (
                <li key={category.value}>
                  <Link
                    href={category.href}
                    className="flex items-center gap-3 px-4 py-2 text-sm text-encre transition hover:bg-brume hover:text-vert-actif"
                  >
                    <CategoryIcon value={category.value} className="h-4 w-4 shrink-0 text-vert-actif" />
                    <span className="truncate">{category.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/categories"
              className="border-t border-ligne px-4 py-3 text-sm font-semibold text-vert-actif transition hover:bg-brume"
            >
              Toutes les catégories →
            </Link>
          </nav>
        ) : (
          <div className="hidden lg:block" />
        )}

        <HeroBannerCarousel slides={slides} className="h-80 sm:h-[22rem] lg:h-[24rem]" />

        <div className="grid grid-cols-2 gap-3 lg:h-[24rem] lg:grid-cols-1 lg:grid-rows-2">
          <Link
            href="/inscription"
            className="flex flex-col justify-between rounded-lg bg-vert-sapin p-4 text-white transition hover:bg-vert-actif"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">Vendeurs</p>
            <div>
              <p className="font-display text-xl font-black leading-tight">0 % de commission</p>
              <p className="mt-1 text-xs text-white/75">Ouvre ta boutique sur KEVA et garde 100 % de tes ventes.</p>
              <p className="mt-3 text-sm font-semibold">Ouvrir ma boutique →</p>
            </div>
          </Link>

          {featuredProduct ? (
            <Link
              href={featuredProduct.href}
              className="group flex flex-col overflow-hidden rounded-lg border border-ligne bg-white transition hover:border-vert-actif"
            >
              <ProductImage
                src={featuredProduct.thumbnail}
                alt={featuredProduct.title}
                className="min-h-0 w-full flex-1 transition duration-500 group-hover:scale-[1.03]"
              />
              <div className="p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cuivre-profond">
                  Meilleure vente
                </p>
                <p className="mt-0.5 line-clamp-1 text-sm font-medium text-encre">{featuredProduct.title}</p>
                <p className="font-mono text-sm font-semibold text-vert-actif">
                  {featuredProduct.price.toLocaleString("fr-FR")} FCFA
                </p>
              </div>
            </Link>
          ) : (
            <Link
              href="#catalogue"
              className="flex flex-col justify-between rounded-lg border border-ligne bg-white p-4 transition hover:border-vert-actif"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-encre/60">Acheteurs</p>
              <div>
                <p className="font-display text-xl font-black leading-tight text-vert-sapin">
                  Paiement à la livraison
                </p>
                <p className="mt-1 text-xs text-encre/70">Commande sans compte, paie à la réception.</p>
                <p className="mt-3 text-sm font-semibold text-vert-actif">Voir le catalogue →</p>
              </div>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
