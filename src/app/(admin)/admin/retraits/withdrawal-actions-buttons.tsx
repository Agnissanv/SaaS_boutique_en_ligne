"use client";

import { useState, useTransition } from "react";
import { markWithdrawalPaid, rejectWithdrawal } from "./actions";

const PAYOUT_METHOD_LABELS: Record<string, string> = {
  wave: "Wave",
  orange_money: "Orange Money",
  mtn_momo: "MTN Mobile Money",
  moov: "Moov Money",
};

export function payoutMethodLabel(method: string): string {
  return PAYOUT_METHOD_LABELS[method] ?? method;
}

/**
 * Boutons "Marquer payé" / "Rejeter" pour une demande de retrait en attente —
 * même pattern que MarkPaidButton (admin/commerciaux) : appel direct de la
 * Server Action via useTransition, pas de formulaire pour le paiement (rien
 * à saisir, juste confirmer un virement déjà fait en dehors de l'app) ; un
 * petit champ inline pour le motif du rejet, qui reste optionnel.
 */
export function WithdrawalActionButtons({ requestId }: { requestId: string }) {
  const [isPending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  if (rejecting) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Motif (optionnel)"
          className="w-40 rounded-md border border-ligne px-2 py-1 text-xs focus:border-vert-actif focus:outline-none"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => rejectWithdrawal(requestId, note))}
            className="rounded-md bg-erreur px-2.5 py-1.5 text-xs font-medium text-ivoire hover:bg-erreur/90 disabled:opacity-50"
          >
            {isPending ? "..." : "Confirmer le rejet"}
          </button>
          <button
            type="button"
            onClick={() => setRejecting(false)}
            className="rounded-md border border-ligne px-2.5 py-1.5 text-xs font-medium text-encre hover:bg-brume"
          >
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => markWithdrawalPaid(requestId))}
        className="rounded-md border border-ligne bg-white px-2.5 py-1.5 text-xs font-medium text-encre transition hover:border-vert-actif hover:text-vert-actif disabled:opacity-50"
      >
        {isPending ? "..." : "Marquer payé"}
      </button>
      <button
        type="button"
        onClick={() => setRejecting(true)}
        className="rounded-md border border-ligne bg-white px-2.5 py-1.5 text-xs font-medium text-encre transition hover:border-erreur hover:text-erreur"
      >
        Rejeter
      </button>
    </div>
  );
}
