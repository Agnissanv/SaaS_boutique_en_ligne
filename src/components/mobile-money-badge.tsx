"use client";

import { useState } from "react";
import { MOBILE_MONEY_OPERATOR_LABELS, type MobileMoneyOperator } from "@/lib/utils/mobile-money";

/**
 * Affiche le numéro Mobile Money PERSONNEL du vendeur — ajouté le 29/09/2026
 * en remplacement du paiement en ligne via Nyole (construit puis abandonné
 * le jour même, voir decisions-techniques.md) : KEVA n'intervient pas dans
 * ce paiement, c'est une simple information affichée sur la boutique, comme
 * `WhatsappContactButton` juste à côté. Pas un lien (contrairement à
 * wa.me) : juste le numéro affiché, avec un bouton "Copier" pour la
 * commodité du client qui va l'utiliser dans son appli Mobile Money.
 */
export function MobileMoneyBadge({
  operator,
  number,
}: {
  operator: MobileMoneyOperator;
  number: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Best-effort — le numéro reste affiché à l'écran de toute façon.
    }
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-ligne bg-brume px-3 py-1.5 text-sm text-encre">
      <span className="font-medium">{MOBILE_MONEY_OPERATOR_LABELS[operator]}</span>
      <span className="font-mono">{number}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="text-xs text-vert-actif underline underline-offset-2"
      >
        {copied ? "Copié !" : "Copier"}
      </button>
    </div>
  );
}
