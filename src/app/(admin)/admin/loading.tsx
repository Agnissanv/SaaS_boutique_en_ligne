import { ViewTransition } from "react";
import { Skeleton } from "@/components/skeleton";

/**
 * Squelette partagé de tout le back-office admin — comble un trou du
 * chantier "langage natif, squelettes de chargement" (15/09/2026) : à
 * l'époque, seuls la marketplace, la boutique publique, la fiche produit et
 * le dashboard vendeur avaient été couverts ; `/admin/*` était resté sans
 * aucun `loading.tsx`, découvert le 23/09/2026 en faisant l'inventaire pour
 * la demande d'Isaac ("occupons-nous du loading design complet du site").
 *
 * Même raisonnement que `(vendor)/dashboard/loading.tsx` : un seul fichier
 * au niveau du segment `/admin` sert de repli `<Suspense>` à `page.tsx`
 * (vue d'ensemble) ET à toute page enfant sans `loading.tsx` propre
 * (vendeurs, abonnements, transactions, codes-promo, commandes, paiements,
 * messages) — la sidebar et la barre supérieure (`layout.tsx` / `AdminNav`)
 * restent affichées, seule la zone de contenu pulse. Générique plutôt que
 * pixel-parfait par page, pour la même raison que côté vendeur : trop de
 * mises en page différentes (tableaux, fiches, formulaires) pour qu'un
 * squelette par page reste un bon rapport effort/valeur.
 */
export default function AdminLoading() {
  return (
    <ViewTransition exit="kv-skeleton-out" default="none">
      <div role="status" aria-live="polite" aria-label="Chargement">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-32 rounded-md" />
        </div>
        <div className="mt-6 flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      </div>
    </ViewTransition>
  );
}
