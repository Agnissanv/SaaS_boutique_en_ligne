"use client";

import { useState } from "react";

/** Le code partenaire en grand, avec un bouton pour le copier. */
export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-mono text-2xl font-semibold tracking-wider text-encre">{code}</span>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Presse-papiers refusé : le code reste affiché.
          }
        }}
        className="shrink-0 rounded-md border border-ligne bg-white px-3 py-1.5 text-xs font-medium text-encre transition hover:border-vert-actif hover:text-vert-actif"
      >
        {copied ? "Copié !" : "Copier le code"}
      </button>
    </div>
  );
}
