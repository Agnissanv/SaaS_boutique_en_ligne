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
      className="inline-flex items-center gap-1.5 rounded-md border border-green-600 px-3 py-1.5 text-sm font-medium text-green-700"
    >
      Partager sur WhatsApp
    </a>
  );
}
