import { ViewTransition } from "react";
import { Skeleton } from "@/components/skeleton";

/**
 * Squelette de la confirmation de commande — même trou et même contexte que
 * `panier/loading.tsx` (voir ce fichier), découvert le 23/09/2026. Reprend la
 * forme réelle de `page.tsx` (refaite le 13/10/2026) : étapes, pastille de
 * réussite + titre + remerciement centrés, carte « Et maintenant ? », puis
 * carte « Récapitulatif » (articles avec photo, totaux). La bannière de
 * création de compte et le formulaire d'avis dépendent de conditions
 * (invité, commande livrée) trop variables pour être approximées ici.
 */
export default function CommandeConfirmationLoading() {
  return (
    <ViewTransition exit="kv-skeleton-out" default="none">
      <main
        role="status"
        aria-live="polite"
        aria-label="Chargement de la commande"
        className="w-full mx-auto max-w-xl px-4 py-8 sm:py-10"
      >
        <div className="mb-8 grid grid-cols-3 justify-items-center gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center">
          <Skeleton className="h-16 w-16 rounded-full" />
          <Skeleton className="mt-5 h-6 w-56" />
          <Skeleton className="mt-3 h-3.5 w-full max-w-xs" />
          <Skeleton className="mt-2 h-3 w-40" />
        </div>

        <div className="mt-8 rounded-2xl border border-ligne bg-white p-5">
          <Skeleton className="h-4 w-32" />
          <div className="mt-4 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2 pt-0.5">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-ligne bg-white">
          <div className="border-b border-ligne px-5 py-3.5">
            <Skeleton className="h-4 w-28" />
          </div>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-ligne px-5 py-3">
              <Skeleton className="h-14 w-14 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-3.5 w-16" />
            </div>
          ))}
          <div className="space-y-2.5 px-5 py-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3.5 w-20" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </ViewTransition>
  );
}
