/**
 * Bloc de squelette générique — chantier "langage natif", volet squelettes de
 * chargement (15/09/2026, voir decisions-techniques.md). Sert de brique pour
 * les `loading.tsx` de chaque route publique : un rectangle Brume traversé
 * par un reflet (voir `.animate-kv-pulse` dans globals.css), pour qu'un écran
 * de chargement reste sur charte KEVA au lieu de trahir un composant
 * "squelette" générique de bibliothèque.
 *
 * Bordure ajoutée le 23/09/2026, à la refonte du reflet : la plupart des
 * surfaces du site sont maintenant blanches (refonte "fond blanc + accents
 * verts", 22/09/2026), et Brume (#f7f5f1) est trop proche du blanc pour se
 * voir tout seul au repos, entre deux passages du reflet — surtout visible
 * sur les cartes boutique/produit, posées sur `bg-white`. Un fin trait
 * Ligne (déjà la bordure standard des cartes du site) rend la forme lisible
 * en permanence, reflet ou pas, quel que soit le fond sur lequel le
 * squelette est posé.
 *
 * `aria-hidden` : purement décoratif, le vrai statut de chargement est porté
 * par le conteneur parent (voir `role="status"`/`aria-live` posé dans chaque
 * `loading.tsx`).
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-kv-pulse rounded-md border border-ligne/60 bg-brume ${className ?? ""}`}
    />
  );
}
