import Link from "next/link";
import { CategoryIcon } from "@/components/category-icon";
import { HeroBannerCarousel } from "@/components/hero-banner-carousel";
import { MarketplaceSearch } from "@/components/marketplace-search";

export type HeroCategoryLink = { value: string; label: string; href: string };

// Ordre voulu par Isaac : 4 (le plus proche du modèle) en premier, puis le reste.
const HERO_IMAGES = [4, 1, 2, 3, 5, 6, 7].map((n) => `/hero/${n}.jpeg`);

const MAX_CHIPS = 6;

/**
 * Hero de la page d'accueil (09/10/2026) — reproduit le modèle fourni par
 * Isaac (`public/hero/model.jpeg`) : un grand bandeau pleine largeur, texte +
 * recherche + pastilles de catégories sur la moitié gauche, carrousel de
 * visuels produits derrière (voir `HeroBannerCarousel`) et badge flottant de
 * promotion à droite. Remplace le hero "3 colonnes" du 06/10/2026.
 *
 * Aucune donnée inventée : le badge "Jusqu'à -X %" n'apparaît que si une vraie
 * promotion existe (`promoDiscount`, calculé dans `page.tsx`), les pastilles
 * ne listent que les catégories qui ont au moins un produit. Le titre est
 * celui voulu par Isaac le 02/10/2026 ("la plus simple de Côte d'Ivoire").
 * Server Component — seul le carrousel et la recherche sont des composants
 * client.
 *
 * L'en-tête (`ScrollHeader`) est `fixed` et transparent par-dessus ce hero :
 * le `padding-top` du bloc de texte (et la hauteur minimale) réserve sa
 * place — environ 4 rem sur desktop, 8,5 rem sur mobile où la recherche passe
 * sur une 2e ligne.
 */
export function HeroMarketplace({
  categories,
  promoDiscount,
  search,
}: {
  categories: HeroCategoryLink[];
  promoDiscount: number | null;
  search: {
    defaultValue: string;
    categorie?: string;
    prixMin?: string;
    prixMax?: string;
    attrs?: Record<string, string[]>;
  };
}) {
  return (
    <section className="relative flex w-full flex-col bg-[#e6f1ea] sm:block">
      <div className="relative z-10 order-1 mx-auto w-full max-w-6xl px-4 pb-8 pt-40 sm:flex sm:min-h-[31rem] sm:items-center sm:pb-12 sm:pt-28 lg:min-h-[33rem]">
        <div className="w-full sm:max-w-[34rem]">
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-vert-sapin shadow-sm ring-1 ring-ligne">
            <ShieldIcon />
            Paiement à la livraison · Commande sans compte
          </p>

          <h1 className="mt-4 text-balance font-display text-4xl font-black leading-[1.05] tracking-tight text-vert-profond sm:text-5xl lg:text-[3.1rem]">
            La marketplace <br className="hidden sm:block" />
            <span className="text-vert-actif">la plus simple de Côte d’Ivoire</span>
          </h1>

          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-encre/80">
            Des vendeurs indépendants partout en Côte d’Ivoire. Commande sans compte, paie à la livraison.
          </p>

          {/* Masquée sur mobile : l'en-tête a déjà sa barre de recherche juste au-dessus. */}
          <div className="mt-6 hidden sm:block">
            <MarketplaceSearch variant="hero" {...search} />
          </div>

          {categories.length > 0 ? (
            <nav aria-label="Catégories populaires" className="mt-4 flex flex-wrap gap-2">
              {categories.slice(0, MAX_CHIPS).map((category) => (
                <Link
                  key={category.value}
                  href={category.href}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm font-medium text-encre shadow-sm ring-1 ring-ligne transition hover:text-vert-actif hover:ring-vert-actif"
                >
                  <CategoryIcon value={category.value} className="h-4 w-4 text-vert-actif" />
                  {category.label}
                </Link>
              ))}
              <Link
                href="/categories"
                className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold text-vert-sapin transition hover:text-vert-actif"
              >
                Voir toutes <span aria-hidden="true">›</span>
              </Link>
            </nav>
          ) : null}

          <Link
            href="/inscription"
            className="mt-5 inline-block text-sm font-medium text-vert-sapin underline transition hover:text-vert-actif"
          >
            Tu vends ? Ouvre ta boutique
          </Link>
        </div>

        {promoDiscount ? (
          <a
            href="#catalogue"
            className="absolute right-4 top-24 hidden items-center gap-3 rounded-2xl bg-white p-3 pr-5 shadow-[0_12px_30px_rgba(14,59,44,0.2)] transition hover:-translate-y-0.5 sm:flex"
          >
            <span
              aria-hidden="true"
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-vert-actif text-white"
            >
              <TagIcon />
            </span>
            <span>
              <span className="block text-xs text-encre/70">Jusqu’à</span>
              <span className="block font-display text-3xl font-black leading-none text-vert-actif">
                -{promoDiscount} %
              </span>
              <span className="mt-1 block text-xs text-encre/70">sur une sélection de produits</span>
            </span>
          </a>
        ) : null}
      </div>

      <HeroBannerCarousel images={HERO_IMAGES} />
    </section>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4 text-vert-actif" aria-hidden="true">
      <path d="M10 2.5l6 2.2v4.6c0 3.8-2.5 6.7-6 8.2-3.5-1.5-6-4.4-6-8.2V4.7l6-2.2z" strokeLinejoin="round" />
      <path d="M7.2 10l2 2 3.6-3.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6" aria-hidden="true">
      <path d="M3 10.2V4a1 1 0 0 1 1-1h6.2a1 1 0 0 1 .7.3l6.1 6.1a1 1 0 0 1 0 1.4l-5.6 5.6a1 1 0 0 1-1.4 0L3.3 10.9a1 1 0 0 1-.3-.7z" strokeLinejoin="round" />
      <circle cx="7" cy="7" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
