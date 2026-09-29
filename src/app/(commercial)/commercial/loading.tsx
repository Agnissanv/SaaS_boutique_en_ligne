import { ViewTransition } from "react";
import { Skeleton } from "@/components/skeleton";

/**
 * Squelette de l'espace commercial (30/09/2026, audit technique — voir
 * audit-technique-2026-09-29.md) : trou dans le chantier "langage natif,
 * squelettes de chargement" — `/commercial` n'existait pas encore au moment
 * de l'inventaire du 23/09/2026 qui a comblé `/admin` et `/compte`
 * (voir `(admin)/admin/loading.tsx` pour le détail du contexte), et n'a
 * jamais été rattrapé depuis sa création le même jour (voir
 * `(commercial)/commercial/layout.tsx`).
 *
 * Un seul écran (pas de dashboard multi-pages comme côté vendeur/admin, pas
 * de sidebar — voir le layout) : le squelette reprend la forme réelle de
 * `page.tsx` plutôt que le générique titre + lignes des trois autres espaces
 * protégés — lien à copier, trois tuiles de commissions, deux listes
 * (vendeurs recrutés, historique des commissions) — un seul écran fixe, donc
 * un bon rapport effort/valeur pour un squelette pixel-proche, contrairement
 * au dashboard vendeur/admin (mises en page trop variées d'une page à
 * l'autre pour que ça vaille le coût par page, voir leurs `loading.tsx`).
 */
export default function CommercialLoading() {
  return (
    <ViewTransition exit="kv-skeleton-out" default="none">
      <div role="status" aria-live="polite" aria-label="Chargement">
        <Skeleton className="h-5 w-52" />

        <div className="mt-6 rounded-lg border border-ligne bg-white p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-9 w-full rounded-md" />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>

        <div className="mt-6 rounded-lg border border-ligne bg-white p-4">
          <Skeleton className="h-4 w-32" />
          <div className="mt-3 flex flex-col gap-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-ligne bg-white p-4">
          <Skeleton className="h-4 w-40" />
          <div className="mt-3 flex flex-col gap-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </ViewTransition>
  );
}
