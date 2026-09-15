import { ViewTransition } from "react";
import { Skeleton } from "@/components/skeleton";

/**
 * Squelette partagé de tout le dashboard vendeur — chantier "langage
 * natif", dashboard vendeur, deuxième tranche (15/09/2026, voir
 * decisions-techniques.md). Un seul fichier au niveau du segment
 * `/dashboard` plutôt qu'un par page : Next.js l'utilise comme repli
 * `<Suspense>` pour `dashboard/page.tsx` (Aperçu) ET pour toute page enfant
 * qui n'a pas son propre `loading.tsx` (produits, commandes, boutique,
 * avis, paiements, abonnement, profil, aide...) — un seul fichier couvre
 * tout le dashboard. La sidebar et la barre supérieure (`layout.tsx`)
 * restent affichées pendant ce temps, seule la zone de contenu pulse.
 *
 * Volontairement générique (lignes de titre + cartes) plutôt qu'une forme
 * par page : le dashboard a trop de mises en page différentes (tableaux,
 * formulaires, fiches) pour qu'un squelette par page reste un bon rapport
 * effort/valeur ici — contrairement aux trois pages publiques, où la forme
 * exacte comptait pour éviter tout saut visuel sur des pages à fort trafic.
 */
export default function DashboardLoading() {
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
