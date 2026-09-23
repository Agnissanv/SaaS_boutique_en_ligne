import Link from "next/link";
import { ViewTransition } from "react";
import { Skeleton } from "@/components/skeleton";

/**
 * Squelette de la page d'accueil marketplace — REFAIT le 23/09/2026, à la
 * demande d'Isaac ("le loading design ne me plaît pas" : contraste sur fond
 * sombre, forme qui ne ressemblait plus au vrai hero, rendu trop générique).
 *
 * L'ancienne version (15/09/2026) approximait un hero en bandeau VERT FONCÉ
 * plein écran — exact à l'époque, mais périmée depuis la refonte du
 * 22/09/2026 ("fond blanc + accents verts") : l'en-tête et le hero sont
 * maintenant blancs/pâles (voir `page.tsx`), donc les blocs clairs
 * (`bg-ivoire/15`) de l'ancien squelette devenaient presque invisibles au
 * creux de leur propre pulsation — d'où le reproche de contraste.
 *
 * Correctif de fond, pas juste un nouveau décor : `page.tsx` est UN SEUL
 * composant serveur asynchrone (pas de `<Suspense>` interne), donc TOUT
 * attend Supabase avant de s'afficher — y compris l'en-tête, le texte du
 * hero, les deux boutons et l'argumentaire de confiance, qui sont pourtant
 * 100% statiques (aucune de ces valeurs ne vient d'une requête). Plutôt que
 * de les remplacer par des blocs gris (générique, et strictement moins
 * fidèle), ce squelette AFFICHE CE CONTENU RÉEL tel quel — logo, titre,
 * sous-titre, argumentaire, ET les deux boutons restent de vrais liens
 * cliquables pendant le chargement — et ne pulse que ce qui dépend
 * réellement de Supabase : les deux chiffres (boutiques/produits), les
 * photos du collage, les puces de catégories, les boutiques mises en avant
 * et les cartes produit. Résultat : impossible que la forme diverge du vrai
 * hero (c'est le même JSX), et plus de fond sombre à gérer puisque le hero
 * réel ne l'est plus.
 */

const HERO_COLLAGE_POSITIONS = [
  "absolute left-0 top-6 h-36 w-36 -rotate-6 lg:h-40 lg:w-40",
  "absolute right-2 top-0 z-10 h-32 w-32 rotate-3 lg:h-36 lg:w-36",
  "absolute bottom-0 left-16 z-20 h-32 w-32 rotate-2 lg:h-36 lg:w-36",
];

function IconDelivery() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <rect x="2.5" y="6" width="10" height="8" rx="1.2" />
      <path d="M12.5 9h3l2 2.5V14h-5" />
      <circle cx="6" cy="15.5" r="1.4" />
      <circle cx="14.5" cy="15.5" r="1.4" />
    </svg>
  );
}
function IconStorefront() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <path d="M3 8.5 4 3h12l1 5.5" />
      <path d="M3 8.5a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 2 1.6V8.5" />
      <path d="M4.5 10v6.5h11V10" />
      <path d="M8.5 16.5V12.5h3v4" />
    </svg>
  );
}
function IconMobileMoney() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <rect x="5.5" y="2.5" width="9" height="15" rx="1.5" />
      <path d="M5.5 5.5h9M5.5 14.5h9" />
      <path d="M10 16.4h.01" strokeLinecap="round" />
    </svg>
  );
}

// Copie strictement identique à TRUST_ITEMS dans `page.tsx` — dupliquée ici
// plutôt qu'importée : ce sont des fonctions locales à `page.tsx`, non
// exportées, et ce contenu ne changera pas indépendamment de l'autre sans
// qu'on touche ce fichier au passage (les deux sont à quelques lignes l'un
// de l'autre dans le même commit le cas échéant).
const TRUST_ITEMS = [
  {
    title: "Paiement à la livraison",
    body: "Commande sans créer de compte, paie en espèces à la réception.",
    icon: <IconDelivery />,
  },
  {
    title: "Vendeurs indépendants",
    body: "Chaque boutique est gérée par son propre vendeur, partout en Côte d'Ivoire.",
    icon: <IconStorefront />,
  },
  {
    title: "Mobile Money bientôt disponible",
    body: "Orange Money, MTN Money, Moov Money et Wave arrivent prochainement.",
    icon: <IconMobileMoney />,
  },
];

export default function HomeLoading() {
  return (
    <ViewTransition exit="kv-skeleton-out" default="none">
      <div role="status" aria-live="polite" aria-label="Chargement du catalogue">
        {/* En-tête — réel, ne dépend d'aucune donnée. Seule la barre de
            recherche (contrôle interactif, pas juste du texte) est en
            squelette. */}
        <header className="sticky top-0 z-20 w-full border-b border-ligne bg-white text-encre">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
            <Link href="/" className="flex shrink-0 items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- logo statique */}
              <img src="/keva-logo.jpg" alt="KEVA" className="h-9 w-9 rounded-md object-cover" />
              <span className="font-display text-lg font-bold tracking-wide text-vert-sapin">
                KEVA
              </span>
            </Link>

            <div className="order-3 flex w-full flex-1 sm:order-2">
              <Skeleton className="h-10 w-full rounded-md" />
            </div>

            <div className="order-2 hidden shrink-0 items-center gap-4 text-sm font-medium sm:order-3 sm:flex">
              <Link href="/favoris" className="hover:text-vert-actif">
                Mes favoris
              </Link>
              <Link href="/compte" className="hover:text-vert-actif">
                Mon compte
              </Link>
            </div>
          </div>
        </header>

        {/* Hero — réel pour tout le texte et les deux boutons (déjà
            cliquables pendant le chargement) ; seuls les deux chiffres et les
            photos du collage dépendent de Supabase. */}
        <section className="w-full bg-white px-3 pb-6 pt-2 sm:px-6 sm:pb-10">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-[28px] bg-gradient-to-br from-[#f2f8f4] to-[#e8f2ec] px-5 py-12 sm:px-10 sm:py-16">
            <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl text-center lg:text-left">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-vert-actif">
                  Vendez · Encaissez · Grandissez
                </p>

                <h1 className="mt-4 text-balance font-display text-4xl font-black leading-[1.03] tracking-tight sm:text-5xl lg:text-[3.4rem]">
                  <span className="text-encre">Toutes les boutiques</span>{" "}
                  <br className="hidden sm:block" />
                  <span className="text-vert-actif">en un seul endroit</span>
                </h1>

                <p className="mt-5 max-w-md text-[15px] leading-relaxed text-encre/70">
                  Des vendeurs indépendants partout en Côte d’Ivoire.
                  Commande sans compte, paie à la livraison.
                </p>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                  <a
                    href="#catalogue"
                    className="flex items-center gap-2 rounded-lg bg-vert-actif px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(28,107,74,0.28)] transition hover:bg-vert-sapin"
                  >
                    Voir le catalogue
                    <span aria-hidden="true">→</span>
                  </a>
                  <Link
                    href="/inscription"
                    className="rounded-lg border border-vert-sapin/25 bg-white/50 px-6 py-3 text-sm font-medium text-vert-sapin transition hover:border-vert-actif hover:text-vert-actif"
                  >
                    Ouvrir ma boutique
                  </Link>
                </div>

                <div className="mt-10 hidden items-center gap-8 sm:flex lg:justify-start">
                  <div>
                    <Skeleton className="h-6 w-10" />
                    <p className="mt-1 text-xs text-encre/50">boutiques</p>
                  </div>
                  <div className="h-8 w-px bg-ligne" />
                  <div>
                    <Skeleton className="h-6 w-10" />
                    <p className="mt-1 text-xs text-encre/50">produits</p>
                  </div>
                </div>
              </div>

              {/* Collage photo — mêmes positions/rotations que le vrai
                  (`HERO_COLLAGE_POSITIONS` dans page.tsx), en squelette plutôt
                  qu'en vraies photos puisqu'elles viennent de Supabase. */}
              <div
                className="relative hidden h-64 w-64 shrink-0 sm:block lg:h-72 lg:w-72"
                aria-hidden="true"
              >
                {HERO_COLLAGE_POSITIONS.map((position, i) => (
                  <Skeleton key={i} className={`rounded-xl ${position}`} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Argumentaire de confiance — réel, texte statique. */}
        <section className="mx-auto mt-8 grid w-full max-w-6xl grid-cols-1 gap-3 px-4 sm:grid-cols-3">
          {TRUST_ITEMS.map((item) => (
            <div
              key={item.title}
              className="flex items-start gap-3 rounded-lg border border-ligne bg-white p-4"
            >
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brume text-vert-actif"
              >
                {item.icon}
              </span>
              <div>
                <p className="text-sm font-medium text-encre">{item.title}</p>
                <p className="mt-1 text-xs text-encre/70">{item.body}</p>
              </div>
            </div>
          ))}
        </section>

        <main className="mx-auto w-full max-w-6xl px-4 pb-10">
          {/* Catégories — titre et lien réels, puces en squelette (la liste
              dépend des produits actifs, voir `availableCategories` dans
              page.tsx). Même bandeau Brume arrondi que `CategoryNav`. */}
          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="font-display text-lg font-semibold text-encre">Catégories</h2>
              <Link href="/categories" className="text-xs font-medium text-vert-actif underline">
                Tout voir
              </Link>
            </div>
            <div className="-mx-4 flex gap-5 overflow-hidden bg-brume px-4 py-5 sm:rounded-2xl sm:py-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex w-20 shrink-0 flex-col items-center gap-2">
                  <Skeleton className="h-14 w-14 rounded-full bg-white" />
                  <Skeleton className="h-2.5 w-12" />
                </div>
              ))}
            </div>
          </div>

          {/* Boutiques sur KEVA */}
          <section className="mt-10">
            <h2 className="font-display text-lg font-semibold text-encre">Boutiques sur KEVA</h2>
            <div className="-mx-4 mt-3 flex gap-4 overflow-hidden px-4 pb-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex w-36 shrink-0 flex-col items-center gap-2 rounded-lg border border-ligne bg-white p-3"
                >
                  <Skeleton className="h-16 w-16 rounded-full" />
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-3 w-14" />
                </div>
              ))}
            </div>
          </section>

          {/* Nouveautés / Meilleures ventes — titres réels (toujours les
              mêmes, indépendants des données), cartes produit en squelette. */}
          {["Nouveautés", "Meilleures ventes"].map((title) => (
            <section key={title} className="mt-10">
              <h2 className="font-display text-lg font-semibold text-encre">{title}</h2>
              <div className="-mx-4 mt-3 flex gap-4 overflow-hidden px-4 pb-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-44 shrink-0 rounded-2xl border border-ligne/70 bg-white p-2.5"
                  >
                    <Skeleton className="aspect-square w-full rounded-xl" />
                    <Skeleton className="mt-2.5 h-3.5 w-full" />
                    <Skeleton className="mt-1.5 h-3.5 w-2/3" />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </main>
      </div>
    </ViewTransition>
  );
}
