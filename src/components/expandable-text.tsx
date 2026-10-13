"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Texte limité à quelques lignes, avec « Lire la suite » seulement s'il
 * dépasse (13/10/2026, audit visuel : la description d'une boutique pouvait
 * occuper tout le premier écran du téléphone et repousser les produits très
 * bas, sur la page que les vendeurs partagent sur WhatsApp).
 */
export function ExpandableText({
  text,
  lines = 3,
  className,
}: {
  text: string;
  lines?: number;
  className?: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (!expanded) setOverflows(el.scrollHeight > el.clientHeight + 1);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [expanded]);

  return (
    <div className={className}>
      <p
        ref={ref}
        className="whitespace-pre-line"
        style={expanded ? undefined : { display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" }}
      >
        {text}
      </p>
      {overflows || expanded ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-sm font-medium text-vert-actif transition-colors hover:text-vert-sapin"
          aria-expanded={expanded}
        >
          {expanded ? "Réduire" : "Lire la suite"}
        </button>
      ) : null}
    </div>
  );
}
