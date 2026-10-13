"use client";

import { useState } from "react";

/**
 * Une ligne « lien à partager » : copier, ou envoyer directement sur
 * WhatsApp (le canal le plus utilisé par la communauté d'Isaac).
 */
export function ShareRow({ label, url, message }: { label: string; url: string; message: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papiers refusé : le lien reste lisible et sélectionnable.
    }
  }

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-encre">{label}</p>
        <p className="truncate font-mono text-xs text-encre/70">{url}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={copy}
          className="rounded-md border border-ligne bg-white px-3 py-1.5 text-xs font-medium text-encre transition hover:border-vert-actif hover:text-vert-actif"
        >
          {copied ? "Copié !" : "Copier"}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${message} ${url}`)}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-ligne bg-white px-3 py-1.5 text-xs font-medium text-encre transition hover:border-vert-actif hover:text-vert-actif"
        >
          WhatsApp
        </a>
      </div>
    </li>
  );
}
