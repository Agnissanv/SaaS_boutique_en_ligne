"use client";

import { useSyncExternalStore, type ReactNode } from "react";

// Distance de défilement (px) à partir de laquelle la barre se remplit.
const SCROLL_THRESHOLD = 24;

function subscribe(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}
const getSnapshot = () => window.scrollY > SCROLL_THRESHOLD;
// Côté serveur (et à l'hydratation) : en haut de page, donc transparente.
const getServerSnapshot = () => false;

/**
 * Barre de navigation "transparente puis pleine au défilement" (09/10/2026,
 * demande d'Isaac). En haut de page, la barre est fixe et transparente : seuls
 * ses boutons sont visibles, par-dessus le hero. Dès que l'on défile, un fond
 * blanc translucide (flou + ombre légère) apparaît en fondu en glissant
 * légèrement depuis le haut.
 *
 * `useSyncExternalStore` plutôt que `useState` + effet : l'état initial est
 * correct même si la page est rechargée en milieu de défilement, et il n'y a
 * aucun `setState` dans un effet. Les éléments enfants adaptent leur style
 * via `group-data-[scrolled=true]:` (la balise porte `group` et
 * `data-scrolled`). Transition coupée sous `prefers-reduced-motion`, comme les
 * autres animations du site.
 *
 * La barre est `fixed` : la page doit réserver sa hauteur (voir le
 * `padding-top` du hero dans `HeroMarketplace`).
 */
export function ScrollHeader({ children }: { children: ReactNode }) {
  const scrolled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <header data-scrolled={scrolled} className="group fixed inset-x-0 top-0 z-30 w-full text-encre">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -translate-y-3 border-b border-ligne bg-white/90 opacity-0 shadow-[0_6px_24px_rgba(14,59,44,0.08)] backdrop-blur-md transition duration-300 ease-out group-data-[scrolled=true]:translate-y-0 group-data-[scrolled=true]:opacity-100 motion-reduce:transition-none"
      />
      <div className="relative">{children}</div>
    </header>
  );
}
