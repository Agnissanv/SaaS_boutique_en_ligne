import { ViewTransition } from "react";
import { Skeleton } from "@/components/skeleton";

/**
 * Squelette partagé de l'espace client connecté (`/compte/profil`,
 * `/compte/commandes`, `/compte/notifications`, `/compte/aide`) — même trou
 * que `/admin`, comblé le 23/09/2026 (voir `(admin)/admin/loading.tsx` pour
 * le détail du contexte). Un seul fichier au niveau du groupe `(protected)`
 * sert de repli `<Suspense>` à ses quatre pages, toutes de simples fiches
 * (titre + sections empilées) sans mise en page commune assez précise pour
 * justifier un squelette par page — même compromis générique que le
 * dashboard vendeur et l'admin plutôt qu'un rendu pixel-parfait par page,
 * réservé aux trois pages publiques à fort trafic (marketplace, boutique,
 * fiche produit).
 */
export default function CompteProtectedLoading() {
  return (
    <ViewTransition exit="kv-skeleton-out" default="none">
      <div role="status" aria-live="polite" aria-label="Chargement">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-3.5 w-64" />
        <div className="mt-6 flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full max-w-md rounded-md" />
          ))}
        </div>
      </div>
    </ViewTransition>
  );
}
