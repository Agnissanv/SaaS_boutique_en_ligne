"use client";

import { useEffect, useState } from "react";

/**
 * Titre du hero mis en scène en deux temps plutôt qu'affiché d'un bloc
 * (28/09/2026, refonte visuelle du hero — voir decisions-techniques.md :
 * Isaac a jugé le hero "patron SaaS générique", cette mise en scène du
 * titre est l'un des trois changements de la réponse). La ligne 1 apparaît
 * en premier, la ligne 2 juste après — le message se pose au lieu d'être
 * juste là au chargement.
 *
 * Ne remplace QUE le contenu du `<h1>` d'origine (mêmes classes, même
 * texte, même `{" "}` + `<br className="hidden sm:block" />` qui règle le
 * bug d'espace mobile du 23/09/2026 — voir ce commentaire dans
 * l'historique de page.tsx, toujours valable ici).
 *
 * Déclenché une seule fois au montage (pas au scroll, contrairement au
 * nuage de photos) : le titre est la toute première chose vue en arrivant
 * sur la page, pas quelque chose qu'on découvre en scrollant.
 * `prefers-reduced-motion` : les deux lignes s'affichent immédiatement,
 * sans décalage ni transition — même règle que le reste du hero.
 */
export function HeroHeadline({ line1, line2 }: { line1: string; line2: string }) {
  const [stage, setStage] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    // `setState` toujours appelé depuis un callback de timer, jamais en
    // direct dans le corps de l'effet (même la branche reduced-motion) —
    // règle eslint `react-hooks/set-state-in-effect`, un timer à 0ms reste
    // imperceptible ici puisque c'est justement le cas "sans animation".
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t0 = setTimeout(() => setStage(2), 0);
      return () => clearTimeout(t0);
    }
    const t1 = setTimeout(() => setStage(1), 60);
    const t2 = setTimeout(() => setStage(2), 340);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <h1 className="mt-4 text-balance font-display text-4xl font-black leading-[1.03] tracking-tight sm:text-5xl lg:text-[3.4rem]">
      <span
        className="inline-block text-encre transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          opacity: stage >= 1 ? 1 : 0,
          transform: stage >= 1 ? "translateY(0)" : "translateY(12px)",
        }}
      >
        {line1}
      </span>{" "}
      <br className="hidden sm:block" />
      <span
        className="inline-block text-vert-actif transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          opacity: stage >= 2 ? 1 : 0,
          transform: stage >= 2 ? "translateY(0)" : "translateY(12px)",
        }}
      >
        {line2}
      </span>
    </h1>
  );
}
