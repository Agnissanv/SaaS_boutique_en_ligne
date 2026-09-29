"use client";

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 900;

/**
 * Chiffre du hero qui compte de 0 jusqu'à sa valeur réelle quand il entre à
 * l'écran, plutôt qu'affiché tel quel (28/09/2026, hero jugé trop statique
 * — voir hero-headline.tsx pour le contexte complet de cette refonte).
 * `IntersectionObserver` à usage unique (`once`, jamais en boucle si on
 * remonte/redescend) ; ease-out cubique pour décélérer en approchant la
 * valeur finale plutôt qu'une interpolation linéaire.
 *
 * `prefers-reduced-motion` : affiche directement la valeur finale, sans
 * observer ni animation — compter est un mouvement, pas juste un texte qui
 * change.
 */
export function AnimatedCounter({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // `setState` toujours appelé depuis un callback de timer/observer,
    // jamais en direct dans le corps de l'effet — règle eslint
    // `react-hooks/set-state-in-effect`, même raisonnement que
    // hero-headline.tsx : un timer à 0ms reste imperceptible, c'est
    // justement le cas "sans animation".
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = setTimeout(() => setDisplay(value), 0);
      return () => clearTimeout(t);
    }

    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();

        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / DURATION_MS);
          const eased = 1 - Math.pow(1 - progress, 3);
          setDisplay(Math.round(value * eased));
          if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [value]);

  return <span ref={ref}>{display.toLocaleString("fr-FR")}</span>;
}
