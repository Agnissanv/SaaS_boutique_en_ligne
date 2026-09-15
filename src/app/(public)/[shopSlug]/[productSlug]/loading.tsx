import { ViewTransition } from "react";
import { Skeleton } from "@/components/skeleton";

/**
 * Squelette de la fiche produit — même mécanique que les deux autres
 * `loading.tsx` (chantier "langage natif", squelettes de chargement,
 * 15/09/2026, voir decisions-techniques.md). Reprend la mise en page deux
 * colonnes réelle (galerie à gauche, informations à droite) pour que
 * l'arrivée du vrai contenu ne déplace rien.
 *
 * Volontairement PAS de nom `<ViewTransition name="product-photo-...">`
 * ici : le morphing (voir `product-gallery.tsx`) ne joue que quand la photo
 * de départ et d'arrivée sont toutes les deux réelles dans le même commit —
 * un squelette n'a pas de photo à faire morpher, il s'efface simplement
 * (voir la doc Next.js : "If the destination suspends into a fallback
 * first, no pair forms, content animates with its enter animation instead").
 */
export default function ProductLoading() {
  return (
    <ViewTransition exit="kv-skeleton-out" default="none">
      <main
        role="status"
        aria-live="polite"
        aria-label="Chargement du produit"
        className="w-full mx-auto max-w-6xl px-4 py-8 sm:py-10"
      >
        <Skeleton className="h-4 w-40" />

        <div className="mt-4 grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
          <div>
            <Skeleton className="aspect-square w-full rounded-xl" />
            <div className="mt-2 flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-16 shrink-0 rounded-md" />
              ))}
            </div>
          </div>

          <div>
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-4 h-7 w-4/5" />
            <Skeleton className="mt-3 h-3.5 w-full" />
            <Skeleton className="mt-1.5 h-3.5 w-3/4" />
            <Skeleton className="mt-5 h-7 w-28" />
            <Skeleton className="mt-6 h-11 w-full rounded-md" />
          </div>
        </div>
      </main>
    </ViewTransition>
  );
}
