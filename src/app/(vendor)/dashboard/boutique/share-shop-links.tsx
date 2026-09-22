"use client";

import { useState } from "react";

type Channel = { key: "whatsapp" | "instagram" | "facebook" | "tiktok"; label: string };

const CHANNELS: Channel[] = [
  { key: "whatsapp", label: "WhatsApp (statut, bio)" },
  { key: "instagram", label: "Instagram (bio)" },
  { key: "facebook", label: "Facebook (page, bio)" },
  { key: "tiktok", label: "TikTok (bio)" },
];

/**
 * Liens de boutique traçables par canal — 22/09/2026, suite de l'audit
 * croissance. Répond à la question qu'un vendeur pose naturellement une
 * fois abonné : "est-ce que mon lien WhatsApp/Instagram amène vraiment des
 * visiteurs ?". Chaque lien n'est qu'un `?src=<canal>` ajouté au lien public
 * habituel — voir migration 0043 pour où ce paramètre est lu et compté
 * (`get_shop_traffic_sources`, affiché sur `/dashboard/statistiques`,
 * Business+).
 *
 * Volontairement pas de raccourcisseur d'URL ni de QR code ici : un simple
 * lien à copier-coller dans une bio suffit pour ce premier jet, cohérent
 * avec le principe du projet de ne pas construire au-delà de ce qui a été
 * demandé.
 */
export function ShareShopLinks({ shopUrl }: { shopUrl: string }) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(key: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(key);
      setTimeout(() => setCopied((current) => (current === key ? null : current)), 2000);
    } catch {
      // Presse-papier indisponible (permission refusée, contexte non
      // sécurisé...) — l'échec est silencieux, le lien reste sélectionnable
      // à la main dans le champ affiché juste à côté.
    }
  }

  return (
    <div className="mt-6 rounded-lg border border-ligne bg-white p-4">
      <h2 className="font-display text-sm font-semibold text-encre">Partager ma boutique</h2>
      <p className="mt-1 text-xs text-encre/60">
        Un lien différent par réseau pour savoir lequel amène le plus de
        visiteurs — retrouve la répartition sur{" "}
        <span className="font-medium text-encre/80">Statistiques</span>{" "}
        (plan Business et plus).
      </p>

      <ul className="mt-3 flex flex-col gap-2">
        {CHANNELS.map((channel) => {
          const url = `${shopUrl}?src=${channel.key}`;
          return (
            <li
              key={channel.key}
              className="flex flex-col gap-1.5 rounded-md border border-ligne/70 bg-brume/40 p-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-encre">{channel.label}</p>
                <p className="truncate font-mono text-[11px] text-encre/50">{url}</p>
              </div>
              <button
                type="button"
                onClick={() => copy(channel.key, url)}
                className="shrink-0 rounded-md border border-ligne bg-white px-3 py-1.5 text-xs font-medium text-encre transition hover:border-vert-actif hover:text-vert-actif"
              >
                {copied === channel.key ? "Copié !" : "Copier le lien"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
