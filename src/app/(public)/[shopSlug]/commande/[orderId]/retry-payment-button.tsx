"use client";

import { useState, useTransition } from "react";
import { initiateOrderPayment } from "../../panier/order-payment-actions";

/**
 * Bouton "Réessayer le paiement", sur la page de confirmation/reçu — ajouté
 * le 29/09/2026 avec le paiement en ligne des commandes (voir
 * decisions-techniques.md). Rendu par la page parente uniquement quand
 * `payment_method === 'mobile_money'` ET `status === 'pending'` : soit le
 * client a fermé/abandonné la page de paiement Nyole avant de payer, soit le
 * tout premier appel depuis cart-checkout.tsx a échoué (Nyole injoignable).
 * Dans les deux cas la commande existe déjà (stock déjà décrémenté par
 * `create_order`) — pas de raison de la refaire, juste de relancer le
 * paiement.
 *
 * Même pattern que CancelOrderButton juste à côté : appel direct d'une
 * Server Action depuis un composant client, l'UUID de commande dans l'URL
 * sert de "jeton de capacité" (même modèle de confiance que le reste de
 * cette page).
 */
export function RetryPaymentButton({ orderId }: { orderId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRetry() {
    setError(null);
    startTransition(async () => {
      // `initiateOrderPayment` redirige elle-même vers Nyole en cas de succès
      // (voir order-payment-actions.ts) — cet appel ne "revient" donc que
      // sur échec, auquel cas on affiche l'erreur pour permettre un nouvel
      // essai.
      const result = await initiateOrderPayment(orderId);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="rounded-md border border-attention/30 bg-attention/5 p-3">
      <p className="text-sm text-encre">
        Le paiement de cette commande n&apos;a pas encore été finalisé.
      </p>
      {error && <p className="mt-1 text-xs text-erreur">{error}</p>}
      <button
        type="button"
        onClick={handleRetry}
        disabled={isPending}
        className="mt-2 rounded-md bg-vert-actif px-3 py-1.5 text-xs font-medium text-ivoire hover:bg-vert-sapin disabled:opacity-50"
      >
        {isPending ? "Redirection..." : "Réessayer le paiement"}
      </button>
    </div>
  );
}
