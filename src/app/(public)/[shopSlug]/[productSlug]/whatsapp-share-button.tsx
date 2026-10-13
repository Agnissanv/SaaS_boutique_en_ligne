"use client";

import { useState } from "react";

/**
 * Partage WhatsApp — demandé par Isaac le 13/09/2026, pertinent vu que les
 * clientes/vendeuses ciblées par la plateforme vivent sur WhatsApp (cahier
 * des charges §2.1, personas). Lien construit côté client (via
 * window.location) plutôt que côté serveur : évite de dépendre d'un en-tête
 * ou d'une variable d'environnement pour connaître l'origine exacte du site.
 *
 * Calculé en initialiseur paresseux de useState plutôt que dans un effect :
 * la valeur ne dépend que de props/window au premier rendu, jamais mise à
 * jour ensuite — pas besoin de re-synchroniser après coup.
 */
export function WhatsappShareButton({ title }: { title: string }) {
  const [href] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const url = window.location.href;
    return `https://wa.me/?text=${encodeURIComponent(`${title} — ${url}`)}`;
  });

  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      // Lien discret à côté du nom de la boutique, sur ordinateur (13/10/2026) ;
      // sur téléphone, le partage est dans la barre du haut.
      className="inline-flex items-center gap-1.5 text-sm font-medium text-vert-actif transition-colors hover:text-vert-sapin"
    >
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
        <path d="M10 13V3" />
        <path d="m6.5 6.5 3.5-3.5 3.5 3.5" />
        <path d="M5 10H4.5A1.5 1.5 0 0 0 3 11.5v4A1.5 1.5 0 0 0 4.5 17h11a1.5 1.5 0 0 0 1.5-1.5v-4a1.5 1.5 0 0 0-1.5-1.5H15" />
      </svg>
      Partager
    </a>
  );
}
