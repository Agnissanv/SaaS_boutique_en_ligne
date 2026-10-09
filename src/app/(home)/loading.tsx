import Link from "next/link";
import { ViewTransition } from "react";
import { Skeleton } from "@/components/skeleton";
import { ScrollHeader } from "@/components/scroll-header";

/**
 * Emplacement (09/10/2026) : ce fichier et `page.tsx` vivent dans le groupe de
 * routes `(home)` (sans effet sur l'URL, toujours `/`). Placé à la racine de
 * `app/`, ce squelette de l'ACCUEIL s'affichait pendant le chargement de
 * n'importe quelle page du site (produit, connexion, 404...) avant leur propre
 * squelette. Dans `(home)`, il ne s'applique plus qu'à l'accueil.
 *
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
        <ScrollHeader>
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
            <Link
              href="/"
              className="flex shrink-0 items-center gap-2 rounded-full bg-white/80 py-1 pl-1 pr-3 backdrop-blur-sm transition group-data-[scrolled=true]:bg-transparent"
            >
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
              <Link
                href="/favoris"
                className="rounded-full bg-white/80 px-3.5 py-1.5 backdrop-blur-sm transition hover:text-vert-actif group-data-[scrolled=true]:bg-transparent"
              >
                Mes favoris
              </Link>
              <Link
                href="/compte"
                className="rounded-full bg-white/80 px-3.5 py-1.5 backdrop-blur-sm transition hover:text-vert-actif group-data-[scrolled=true]:bg-transparent"
              >
                Mon compte
              </Link>
            </div>
          </div>
        </ScrollHeader>

        {/* Hero (09/10/2026) en squelette : même bandeau que `HeroMarketplace`
            — le titre, le texte et le lien vendeur sont réels (cliquables
            pendant le chargement), seuls la barre de recherche, les pastilles
            et le visuel dépendent de Supabase/du client. */}
        <section className="relative flex w-full flex-col bg-[#e6f1ea] sm:block">
          <div className="relative z-10 order-2 -mt-6 rounded-t-[1.75rem] bg-white sm:order-1 sm:mt-0 sm:rounded-none sm:bg-transparent">
            <div className="relative mx-auto w-full max-w-6xl px-4 pb-6 pt-6 sm:flex sm:min-h-[31rem] sm:items-center sm:pb-12 sm:pt-28 lg:min-h-[33rem]">
              <div className="w-full sm:max-w-[34rem]">
                <Skeleton className="hidden h-7 w-72 rounded-full sm:block" />
                <h1 className="text-balance font-display text-[1.7rem] font-black leading-[1.1] tracking-tight text-vert-profond sm:mt-4 sm:text-5xl sm:leading-[1.05] lg:text-[3.1rem]">
                  La marketplace <br className="hidden sm:block" />
                  <span className="text-vert-actif">la plus simple de Côte d’Ivoire</span>
                </h1>
                <p className="mt-2 text-sm text-encre/80 sm:hidden">Commande sans compte, paie à la livraison.</p>
                <p className="mt-4 hidden max-w-md text-[15px] leading-relaxed text-encre/80 sm:block">
                  Des vendeurs indépendants partout en Côte d’Ivoire. Commande sans compte, paie à la livraison.
                </p>
                <Skeleton className="mt-6 hidden h-12 w-full rounded-full sm:block" />
                <div className="-mx-4 mt-4 flex gap-2 overflow-hidden px-4 sm:mx-0 sm:flex-wrap sm:px-0" aria-hidden="true">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 w-24 shrink-0 rounded-full" />
                  ))}
                </div>
                <a
                  href="#catalogue"
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-vert-actif px-6 py-3 text-sm font-semibold text-white sm:hidden"
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
            </div>
          </div>
          <Skeleton className="order-1 h-80 sm:order-2 sm:absolute sm:inset-0 sm:z-0 sm:h-auto" />
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
