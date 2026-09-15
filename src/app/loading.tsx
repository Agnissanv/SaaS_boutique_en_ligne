import { ViewTransition } from "react";
import { Skeleton } from "@/components/skeleton";

/**
 * Squelette de la page d'accueil marketplace — affiché automatiquement par
 * Next.js (convention `loading.tsx`) pendant que `page.tsx` (Server
 * Component async, en attente de Supabase) résout, aussi bien au premier
 * chargement qu'à chaque retour sur "/" depuis une autre page. Chantier
 * "langage natif", volet squelettes de chargement (15/09/2026, voir
 * decisions-techniques.md).
 *
 * Ne reproduit pas le vrai en-tête au pixel près (maintenu une seule fois
 * dans `page.tsx`) : juste sa forme et sa couleur, pour qu'il n'y ait pas de
 * flash de fond blanc avant que le vrai en-tête n'apparaisse. Le reste
 * (hero, puces de catégories, bandes produit) est une approximation pulsée
 * de la disposition réelle, pas un squelette générique.
 */
export default function HomeLoading() {
  return (
    <ViewTransition exit="kv-skeleton-out" default="none">
      <main
        role="status"
        aria-live="polite"
        aria-label="Chargement du catalogue"
        className="w-full mx-auto max-w-6xl px-4 pb-10"
      >
        {/* En-tête, forme seulement */}
        <div className="sticky top-0 z-20 -mx-4 flex items-center gap-4 bg-vert-sapin px-4 py-3">
          <div className="h-9 w-9 shrink-0 rounded-md bg-ivoire/15" />
          <Skeleton className="h-9 flex-1 bg-ivoire/15" />
        </div>

        {/* Hero */}
        <div className="-mx-4 bg-vert-profond px-4 py-12 sm:py-16">
          <div className="mx-auto flex max-w-xl flex-col items-center gap-3">
            <Skeleton className="h-3 w-40 bg-ivoire/15" />
            <Skeleton className="h-9 w-full bg-ivoire/15" />
            <Skeleton className="h-9 w-4/5 bg-ivoire/15" />
            <Skeleton className="mt-2 h-10 w-44 bg-ivoire/15" />
          </div>
        </div>

        {/* Puces de catégories */}
        <div className="mt-6 flex gap-3 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-16 shrink-0 rounded-full" />
          ))}
        </div>

        {/* Bandes produit (Meilleures ventes / Nouveautés) */}
        {Array.from({ length: 2 }).map((_, row) => (
          <div key={row} className="mt-8">
            <Skeleton className="h-5 w-40" />
            <div className="mt-3 flex gap-4 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-36 shrink-0 rounded-lg border border-ligne p-3">
                  <Skeleton className="aspect-square w-full rounded-md" />
                  <Skeleton className="mt-2 h-3.5 w-full" />
                  <Skeleton className="mt-1.5 h-3.5 w-2/3" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>
    </ViewTransition>
  );
}
