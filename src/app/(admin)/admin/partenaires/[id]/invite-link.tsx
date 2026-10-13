"use client";

import { useState } from "react";

/** Lien d'invitation : copier, ou l'envoyer directement sur WhatsApp. */
export function InviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const message = `Voici ton lien pour activer ton espace partenaire KEVA (valable 7 jours) : ${url}`;
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-md border border-ligne bg-brume/40 p-2.5 sm:flex-row sm:items-center sm:justify-between">
      <p className="min-w-0 truncate font-mono text-xs text-encre/70">{url}</p>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              // Presse-papiers refusé : le lien reste sélectionnable.
            }
          }}
          className="rounded-md border border-ligne bg-white px-3 py-1.5 text-xs font-medium text-encre hover:border-vert-actif hover:text-vert-actif"
        >
          {copied ? "Copié !" : "Copier"}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-md bg-vert-actif px-3 py-1.5 text-xs font-medium text-ivoire hover:bg-vert-sapin"
        >
          Envoyer sur WhatsApp
        </a>
      </div>
    </div>
  );
}
