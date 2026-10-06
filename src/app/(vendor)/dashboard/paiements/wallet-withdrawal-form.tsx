"use client";

import { useActionState } from "react";
import { requestWithdrawal, type RequestWithdrawalState } from "./wallet-actions";

const PAYOUT_METHODS = [
  { value: "wave", label: "Wave" },
  { value: "orange_money", label: "Orange Money" },
  { value: "mtn_momo", label: "MTN Mobile Money" },
  { value: "moov", label: "Moov Money" },
];

/**
 * Formulaire "Demander un retrait" du portefeuille vendeur (29/09/2026) —
 * même convention `useActionState` que CreateCommercialForm. N'affiche
 * jamais un solde négatif de confiance : la vraie barrière (solde suffisant,
 * minimum 1000 FCFA) est dans la RPC `request_vendor_withdrawal`, ce
 * formulaire ne fait que relayer et afficher son retour.
 */
export function WalletWithdrawalForm({
  shopId,
  minAmount,
}: {
  shopId: string;
  minAmount: number;
}) {
  const initialState: RequestWithdrawalState = {};
  const requestWithdrawalForShop = requestWithdrawal.bind(null, shopId);
  const [state, formAction] = useActionState(requestWithdrawalForShop, initialState);

  return (
    <div className="mt-3 rounded-lg border border-ligne bg-white p-4">
      <h3 className="text-sm font-medium text-encre">Demander un retrait</h3>
      <p className="mt-1 text-xs text-encre/60">
        Isaac te contactera pour effectuer le virement Mobile Money — pas de
        transfert automatique, mais ta demande est suivie ici.
      </p>

      <form action={formAction} className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:min-w-[140px]">
          <label htmlFor="withdrawal-amount" className="text-xs font-medium text-encre">
            Montant (FCFA)
          </label>
          <input
            id="withdrawal-amount"
            name="amount"
            type="number"
            min={minAmount}
            step={1}
            required
            placeholder={`Min. ${minAmount}`}
            className="rounded-md border border-ligne px-3 py-2 text-sm focus:ring-2 focus:ring-vert-actif"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:min-w-[160px]">
          <label htmlFor="withdrawal-method" className="text-xs font-medium text-encre">
            Moyen de réception
          </label>
          <select
            id="withdrawal-method"
            name="payoutMethod"
            required
            defaultValue=""
            className="rounded-md border border-ligne bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-vert-actif"
          >
            <option value="" disabled>
              Choisir...
            </option>
            {PAYOUT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:min-w-[160px]">
          <label htmlFor="withdrawal-phone" className="text-xs font-medium text-encre">
            Numéro de réception
          </label>
          <input
            id="withdrawal-phone"
            name="payoutPhone"
            type="tel"
            required
            placeholder="+225 07 00 00 00 00"
            className="rounded-md border border-ligne px-3 py-2 text-sm focus:ring-2 focus:ring-vert-actif"
          />
        </div>
        <button
          type="submit"
          className="shrink-0 rounded-md bg-vert-actif px-4 py-2 text-sm font-medium text-ivoire transition hover:bg-vert-sapin"
        >
          Envoyer la demande
        </button>
      </form>

      {state.error && <p className="mt-3 text-sm text-erreur">{state.error}</p>}
      {state.success && (
        <p className="mt-3 text-sm text-succes">
          Demande envoyée — Isaac va te contacter pour le virement.
        </p>
      )}
    </div>
  );
}
