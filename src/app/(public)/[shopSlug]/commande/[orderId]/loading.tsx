import { ViewTransition } from "react";
import { Skeleton } from "@/components/skeleton";

/**
 * Squelette de la confirmation de commande — même trou et même contexte que
 * `panier/loading.tsx` (voir ce fichier), découvert le 23/09/2026. Reprend la
 * forme réelle de `page.tsx` : titre "Commande confirmée" + phrase de
 * remerciement, un `<dl>` Statut/Paiement, un titre "Détail" avec la liste
 * des articles, puis un `<dl>` de totaux (Sous-total/Livraison/Total). La
 * bannière de création de compte et le formulaire d'avis dépendent de
 * conditions (invité, commande livrée) trop variables pour être approximées
 * ici — le squelette couvre le contenu qui s'affiche systématiquement.
 */
export default function CommandeConfirmationLoading() {
  return (
    <ViewTransition exit="kv-skeleton-out" default="none">
      <main
        role="status"
        aria-live="polite"
        aria-label="Chargement de la commande"
        className="w-full mx-auto max-w-xl px-4 py-10"
      >
        <Skeleton className="h-5 w-52" />
        <Skeleton className="mt-3 h-3.5 w-full max-w-sm" />

        <div className="mt-6 divide-y divide-ligne">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>

        <Skeleton className="mt-6 h-4 w-16" />
        <div className="mt-2 divide-y divide-ligne">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3.5 w-16" />
            </div>
          ))}
        </div>

        <div className="mt-4 divide-y divide-ligne">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 w-16" />
            </div>
          ))}
        </div>
      </main>
    </ViewTransition>
  );
}
