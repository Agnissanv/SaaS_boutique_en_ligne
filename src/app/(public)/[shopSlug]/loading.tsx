import { ViewTransition } from "react";
import { Skeleton } from "@/components/skeleton";

/**
 * Squelette de la page boutique publique — même mécanique que
 * `src/app/loading.tsx` (chantier "langage natif", squelettes de chargement,
 * 15/09/2026, voir decisions-techniques.md), affiché par Next.js pendant que
 * `page.tsx` résout. Reprend la forme réelle (bannière, carte d'identité qui
 * chevauche, grille de produits) sans dupliquer son détail.
 */
export default function ShopLoading() {
  return (
    <ViewTransition exit="kv-skeleton-out" default="none">
      <main
        role="status"
        aria-live="polite"
        aria-label="Chargement de la boutique"
        className="mx-auto max-w-6xl px-4 py-6 sm:py-8"
      >
        <div className="h-24 w-full rounded-xl bg-vert-profond/40 sm:h-32" />

        <div className="relative z-10 -mt-8 rounded-xl border border-ligne bg-white p-4 shadow-sm sm:-mt-12 sm:p-6">
          <div className="flex flex-wrap items-start gap-4">
            <Skeleton className="h-16 w-16 shrink-0 rounded-full border-4 border-white sm:h-20 sm:w-20" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="mt-2 h-3.5 w-32" />
              <Skeleton className="mt-2 h-3.5 w-full max-w-md" />
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="rounded-md border border-ligne bg-white p-3">
              <Skeleton className="aspect-square w-full rounded" />
              <Skeleton className="mt-2 h-3.5 w-full" />
              <Skeleton className="mt-1.5 h-3.5 w-1/2" />
            </div>
          ))}
        </div>
      </main>
    </ViewTransition>
  );
}
