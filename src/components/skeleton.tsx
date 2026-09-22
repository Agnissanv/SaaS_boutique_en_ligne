/**
 * Bloc de squelette générique — chantier "langage natif", volet squelettes de
 * chargement (15/09/2026, voir decisions-techniques.md). Sert de brique pour
 * les `loading.tsx` de chaque route publique : un simple rectangle qui
 * pulse doucement, en Sable (`--color-sable`) plutôt qu'un gris générique,
 * pour qu'un écran de chargement reste sur charte KEVA au lieu de trahir un
 * composant "squelette" générique de bibliothèque.
 *
 * `aria-hidden` : purement décoratif, le vrai statut de chargement est porté
 * par le conteneur parent (voir `role="status"`/`aria-live` posé dans chaque
 * `loading.tsx`).
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-kv-pulse rounded-md bg-brume ${className ?? ""}`} />;
}
