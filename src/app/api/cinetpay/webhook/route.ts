import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Webhook de notification CinetPay (paiement commande ou abonnement).
 * CinetPay appelle cette URL en POST après un paiement.
 *
 * TODO avant mise en prod :
 * - Vérifier la signature/le token CinetPay (voir leur doc "notify_url").
 * - Appeler l'API CinetPay "check payment status" pour confirmer le montant
 *   plutôt que de faire confiance au seul payload reçu.
 */
export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);

  if (!payload) {
    return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // Le payload exact dépend de la config CinetPay (transaction_id, status, amount...).
  await supabase.from("payments").insert({
    provider: "cinetpay",
    provider_transaction_id: payload.transaction_id ?? payload.cpm_trans_id ?? null,
    amount: payload.amount ?? payload.cpm_amount ?? null,
    currency: "XOF",
    status: "pending", // à mettre à jour après vérification côté CinetPay
    raw_payload: payload,
  });

  return NextResponse.json({ received: true });
}
