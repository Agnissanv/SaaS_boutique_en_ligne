"use client";

import { useEffect, useRef } from "react";
import { markNotificationsRead } from "./actions";

/**
 * Déclenche le marquage "lu" au vrai montage client de la page, jamais
 * pendant son rendu serveur — voir `page.tsx`/`actions.ts` (audit
 * pré-lancement du 22/09/2026) : un prefetch du lien de la cloche (visible
 * dans le header de tout le dashboard) exécute le rendu serveur de cette
 * page sans que le vendeur ne l'ouvre jamais, ce qui effaçait silencieusement
 * le badge "non lu" avant même qu'il les ait vues. Un `useEffect` client ne
 * s'exécute qu'après une vraie navigation/hydratation, jamais pendant un
 * prefetch — `done` évite un double envoi si le composant se re-rend avant
 * la fin de la requête.
 */
export function MarkNotificationsRead({ ids }: { ids: string[] }) {
  const done = useRef(false);

  useEffect(() => {
    if (done.current || ids.length === 0) return;
    done.current = true;
    markNotificationsRead(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ne doit s'exécuter qu'une fois par montage, pas à chaque changement de référence de `ids`.
  }, []);

  return null;
}
