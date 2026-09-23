"use client";

import { useState } from "react";

/**
 * Bouton "Copier" générique pour un lien à partager — même pattern que
 * `ShareShopLinks` (dashboard/boutique/share-shop-links.tsx, migration
 * 0043) : `navigator.clipboard`, échec silencieux (le lien reste
 * sélectionnable à la main dans le champ affiché à côté), retour à l'état
 * normal après 2 secondes.
 *
 * Déplacé ici depuis dashboard/parrainage/copy-referral-link.tsx le
 * 23/09/2026 (extension du parrainage aux commerciaux) : le même composant
 * sert maintenant au lien de parrainage vendeur (`/dashboard/parrainage`)
 * ET au lien de parrainage commercial (`/commercial`), donc partagé dans
 * `src/components/` plutôt que dupliqué ou importé à travers deux groupes
 * de routes différents.
 */
export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papier indisponible — le champ juste à côté reste utilisable.
    }
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-ligne/70 bg-brume/40 p-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <p className="min-w-0 truncate font-mono text-xs text-encre/70">{url}</p>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-md border border-ligne bg-white px-3 py-1.5 text-xs font-medium text-encre transition hover:border-vert-actif hover:text-vert-actif"
      >
        {copied ? "Copié !" : "Copier le lien"}
      </button>
    </div>
  );
}
