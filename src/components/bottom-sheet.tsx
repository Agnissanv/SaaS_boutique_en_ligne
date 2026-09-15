"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Feuille d'action façon appli native — remplace les `<select>`/menus
 * déroulants du navigateur, une des différences les plus visibles entre
 * "site web" et "appli installée" (chantier "langage natif", 15/09/2026,
 * voir decisions-techniques.md). Remonte du bas avec la même courbe
 * d'accélération que le reste du langage tactile (`--ease-native`,
 * `globals.css`), poignée de glissement en haut, fermeture au clic sur le
 * fond, à la touche Échap, ou en glissant la feuille vers le bas.
 *
 * Reste montée pendant l'animation de sortie (`closing`) plutôt que
 * démontée immédiatement au clic sur le fond — sans ça, la feuille
 * disparaîtrait d'un coup au lieu de redescendre.
 *
 * Verrouille le défilement du corps de page tant qu'elle est ouverte — un
 * réflexe d'appli native (le fond ne doit jamais bouger sous une feuille
 * ouverte), absent par défaut sur le web.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  const dragStartY = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Ajustement d'état pendant le rendu plutôt que dans un effet (motif
  // recommandé par React pour "dériver un état qui doit temporairement
  // retarder une prop" — https://react.dev/learn/you-might-not-need-an-effect) :
  // évite un rendu en cascade juste pour synchroniser `mounted`/`closing`
  // avec la prop `open`. Seul le minuteur de démontage ci-dessous, qui
  // s'abonne réellement à une horloge externe, reste dans un `useEffect`.
  if (open !== prevOpen) {
    setPrevOpen(open);
    setClosing(!open);
    if (open) {
      setMounted(true);
      setDragOffset(0);
    }
  }

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => setMounted(false), 320);
    return () => clearTimeout(timer);
  }, [closing]);

  useEffect(() => {
    if (!mounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [mounted, onClose]);

  if (!mounted) return null;

  function handleTouchStart(e: React.TouchEvent) {
    dragStartY.current = e.touches[0].clientY;
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (dragStartY.current === null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    if (delta > 0) setDragOffset(delta);
  }
  function handleTouchEnd() {
    if (dragOffset > 80) {
      onClose();
    } else {
      setDragOffset(0);
    }
    dragStartY.current = null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 bg-vert-profond/50"
        style={{
          // Fondu simple (pas la courbe à dépassement du panneau) : une
          // opacité qui "rebondirait" au-delà de 1 n'a pas de sens visuel.
          animation: `sheet-backdrop-in var(--duration-sheet) ease ${closing ? "reverse" : "normal"} both`,
        }}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white pb-[max(16px,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(4,20,15,0.15)]"
        style={{
          animation: closing ? undefined : "sheet-slide-up var(--duration-sheet) var(--ease-native) both",
          transform: closing
            ? "translateY(100%)"
            : dragOffset
              ? `translateY(${dragOffset}px)`
              : undefined,
          transition: closing ? "transform var(--duration-sheet) var(--ease-native)" : dragOffset ? "none" : undefined,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex justify-center pb-1 pt-2.5">
          <span className="h-1 w-9 rounded-full bg-ligne" aria-hidden="true" />
        </div>
        {title ? (
          <p className="px-4 pb-2 pt-1 text-center font-display text-base font-semibold text-encre">{title}</p>
        ) : null}
        <div className="px-2 pb-2">{children}</div>
      </div>
    </div>
  );
}
