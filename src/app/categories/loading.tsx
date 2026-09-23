import { ViewTransition } from "react";
import { Skeleton } from "@/components/skeleton";

/**
 * Squelette de la page "Toutes les catégories" — comble un trou du chantier
 * "langage natif, squelettes de chargement" (15/09/2026) : cette page
 * (créée le 16/09/2026, après ce chantier) n'avait jamais reçu le sien,
 * découvert le 23/09/2026 en faisant l'inventaire pour la demande d'Isaac
 * ("occupons-nous du loading design complet du site"). Page publique à
 * trafic significatif (accessible depuis la barre de navigation basse) :
 * reprend la forme réelle (fil d'ariane, titre, grille de tuiles carrées)
 * comme les trois autres pages publiques, plutôt qu'un squelette générique.
 */
export default function CategoriesLoading() {
  return (
    <ViewTransition exit="kv-skeleton-out" default="none">
      <main
        role="status"
        aria-live="polite"
        aria-label="Chargement des catégories"
        className="w-full mx-auto max-w-6xl px-4 py-6 sm:py-8"
      >
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="mt-3 h-7 w-56" />
        <Skeleton className="mt-2 h-3.5 w-72" />

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-lg border border-ligne bg-white">
              <Skeleton className="aspect-square w-full rounded-none" />
              <div className="p-2.5">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="mt-1.5 h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </ViewTransition>
  );
}
