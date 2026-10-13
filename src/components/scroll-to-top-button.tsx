"use client";

import { useEffect, useState } from "react";

/**
 * Bouton "remonter en haut" — ajouté le 22/09/2026 (retour d'Isaac sur la
 * fluidité générale du site : "remonté vers le haut"). Monté une seule fois
 * dans `layout.tsx`, donc présent sur toutes les pages sans rien à ajouter
 * page par page — utile en particulier sur les grilles longues (marketplace,
 * page boutique) et la fiche produit (avis, produits similaires en bas).
 *
 * Caché par défaut, apparaît seulement après un scroll significatif (une
 * hauteur d'écran) pour ne jamais gêner en haut de page où il ne servirait à
 * rien. Le clic déclenche `scrollTo({ behavior: "smooth" })` explicitement
 * plutôt que de compter sur le `scroll-behavior: smooth` CSS (globals.css) :
 * ce dernier est déjà coupé sous `prefers-reduced-motion`, donc les deux
 * mécanismes se combinent naturellement pour respecter ce réglage sans code
 * dupliqué ici.
 *
 * Position mobile : juste au-dessus des barres du bas RÉELLEMENT affichées
 * (13/10/2026) — chacune publie sa hauteur dans une variable CSS
 * (`--bottom-nav-offset` pour la navigation basse, `--sticky-cta-offset` pour
 * « Ajouter au panier » sur la fiche produit), au lieu de toujours partir du
 * pire cas (148px). Sur desktop (`sm:`), aucune de ces barres n'existe :
 * simple `sm:bottom-8`.
 */
export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setVisible(window.scrollY > window.innerHeight * 0.75);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function handleClick() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Remonter en haut de la page"
      // Au-dessus des barres du bas réellement affichées (navigation,
      // « Ajouter au panier »), qu'il suit quand elles bougent (13/10/2026).
      className={`fixed right-4 bottom-[calc(var(--bottom-nav-offset,0px)+var(--sticky-cta-offset,0px)+1rem)] z-30 flex h-11 w-11 items-center justify-center rounded-full bg-vert-sapin text-ivoire shadow-[0_6px_14px_rgba(4,20,15,0.3)] transition-[opacity,bottom] duration-300 sm:bottom-8 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
