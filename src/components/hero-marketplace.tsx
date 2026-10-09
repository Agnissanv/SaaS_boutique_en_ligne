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
      {/* Mobile : feuille blanche qui chevauche le visuel (placé au-dessus, voir
          HeroBannerCarousel). Desktop : bloc transparent posé sur le visuel. */}
      <div className="relative z-10 order-2 -mt-6 rounded-t-[1.75rem] bg-white sm:order-1 sm:mt-0 sm:rounded-none sm:bg-transparent">
        <div className="relative mx-auto w-full max-w-6xl px-4 pb-6 pt-6 sm:flex sm:min-h-[31rem] sm:items-center sm:pb-12 sm:pt-28 lg:min-h-[33rem]">
          <div className="w-full sm:max-w-[34rem]">
          <p className="hidden items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-vert-sapin shadow-sm ring-1 ring-ligne sm:inline-flex">
            <ShieldIcon />
            Paiement à la livraison · Commande sans compte
          </p>

          <h1 className="text-balance font-display text-[1.7rem] font-black leading-[1.1] tracking-tight text-vert-profond sm:mt-4 sm:text-5xl sm:leading-[1.05] lg:text-[3.1rem]">
            La marketplace <br className="hidden sm:block" />
            <span className="text-vert-actif">la plus simple de Côte d’Ivoire</span>
          </h1>

          {/* Mobile : une seule ligne (le trio de confiance juste dessous dit déjà le reste). */}
          <p className="mt-2 text-sm text-encre/80 sm:hidden">Commande sans compte, paie à la livraison.</p>
          <p className="mt-4 hidden max-w-md text-[15px] leading-relaxed text-encre/80 sm:block">
            Des vendeurs indépendants partout en Côte d’Ivoire. Commande sans compte, paie à la livraison.
          </p>

          {/* Masquée sur mobile : l'en-tête a déjà sa barre de recherche juste au-dessus. */}
          <div className="mt-6 hidden sm:block">
            <MarketplaceSearch variant="hero" {...search} />
          </div>

          {categories.length > 0 ? (
            <nav
              aria-label="Catégories populaires"
              className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden"
            >
              {categories.slice(0, MAX_CHIPS).map((category) => (
                <Link
                  key={category.value}
                  href={category.href}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm font-medium text-encre shadow-sm ring-1 ring-ligne transition hover:text-vert-actif hover:ring-vert-actif"
                >
                  <CategoryIcon value={category.value} className="h-4 w-4 text-vert-actif" />
                  {category.label}
                </Link>
              ))}
              <Link
                href="/categories"
                className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold text-vert-sapin transition hover:text-vert-actif"
              >
                Voir toutes <span aria-hidden="true">›</span>
              </Link>
            </nav>
          ) : null}

          {/* Mobile : bouton plein largeur (sur desktop, la recherche joue ce rôle). */}
          <a
            href="#catalogue"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-vert-actif px-6 py-3 text-sm font-semibold text-white transition hover:bg-vert-sapin sm:hidden"
          >
            Voir le catalogue <span aria-hidden="true">→</span>
          </a>

          <Link
            href="/inscription"
            className="mt-4 block text-center text-sm font-medium text-vert-sapin underline transition hover:text-vert-actif sm:mt-5 sm:inline-block sm:text-left"
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
      </div>

      {/* Mobile : badge compact posé sur le visuel (le grand badge est réservé au desktop). */}
      {promoDiscount ? (
        <a
          href="#catalogue"
          className="absolute right-3 top-[13.5rem] z-20 flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-black text-vert-actif shadow-[0_6px_16px_rgba(14,59,44,0.2)] sm:hidden"
        >
          <span aria-hidden="true" className="text-vert-actif">
            <TagIcon small />
          </span>
          Jusqu’à -{promoDiscount} %
        </a>
      ) : null}

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

function TagIcon({ small = false }: { small?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={small ? "h-4 w-4" : "h-6 w-6"} aria-hidden="true">
      <path d="M3 10.2V4a1 1 0 0 1 1-1h6.2a1 1 0 0 1 .7.3l6.1 6.1a1 1 0 0 1 0 1.4l-5.6 5.6a1 1 0 0 1-1.4 0L3.3 10.9a1 1 0 0 1-.3-.7z" strokeLinejoin="round" />
      <circle cx="7" cy="7" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
