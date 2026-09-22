"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { initiateSubscriptionPayment, type InitiatePaymentState } from "./actions";

function SubmitButton({ planName }: { planName: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-3 w-full rounded-md bg-vert-actif px-3 py-2 text-sm font-medium text-ivoire hover:bg-vert-sapin disabled:opacity-50"
    >
      {pending ? "Redirection vers le paiement..." : `Passer au plan ${planName}`}
    </button>
  );
}

/**
 * Bouton de paiement réel CinetPay pour passer à un plan payant — ajouté le
 * 15/09/2026 (compte marchand CinetPay validé, voir decisions-techniques.md).
 * Soumet `initiateSubscriptionPayment` qui redirige directement vers le
 * guichet CinetPay en cas de succès (la redirection se fait côté serveur,
 * cette page ne revoit jamais la main sauf en cas d'erreur avant paiement).
 */
export function UpgradeButton({ planCode, planName }: { planCode: string; planName: string }) {
  const [state, formAction] = useActionState<InitiatePaymentState, FormData>(
    initiateSubscriptionPayment,
    {}
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="planCode" value={planCode} />
      <SubmitButton planName={planName} />
      {state.error && <p className="mt-2 text-xs text-erreur">{state.error}</p>}
    </form>
  );
}
