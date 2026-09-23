import { ViewTransition } from "react";
import { Skeleton } from "@/components/skeleton";

/**
 * Squelette du panier — comble un trou du chantier "langage natif, squelettes
 * de chargement" (15/09/2026), découvert le 23/09/2026 en faisant l'inventaire
 * pour la demande d'Isaac ("occupons-nous du loading design complet du
 * site"). `page.tsx` ne fait qu'une requête légère (nom/frais de livraison de
 * la boutique) avant de rendre `<CartCheckout>` (client, lit le panier depuis
 * le stockage local) — le panier lui-même n'attend jamais ce squelette en
 * pratique, mais le cahier des charges (§9, "connexion internet peut être
 * instable → prévoir des états de chargement") justifie de le couvrir quand
 * même. Reprend la forme réelle de l'étape "panier" de `cart-checkout.tsx` :
 * liste d'articles (titre + prix + compteur), puis un résumé `<dl>`
 * Sous-total/Livraison/Total, puis le bouton "Passer la commande".
 */
export default function PanierLoading() {
  return (
    <ViewTransition exit="kv-skeleton-out" default="none">
      <main
        role="status"
        aria-live="polite"
        aria-label="Chargement du panier"
        className="w-full mx-auto max-w-xl px-4 py-10"
      >
        <Skeleton className="h-6 w-48" />

        <div className="mt-6 divide-y divide-ligne rounded-lg border border-ligne bg-white">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="mt-2 h-3.5 w-16" />
              </div>
              <Skeleton className="h-8 w-24 shrink-0 rounded-md" />
            </div>
          ))}
        </div>

        <div className="mt-4 divide-y divide-ligne rounded-lg border border-ligne bg-white px-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2.5">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3.5 w-16" />
            </div>
          ))}
        </div>

        <Skeleton className="mt-4 h-10 w-full rounded-md" />
      </main>
    </ViewTransition>
  );
}
