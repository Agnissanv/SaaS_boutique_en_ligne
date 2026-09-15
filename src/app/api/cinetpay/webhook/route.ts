import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { checkCinetPayTransactionStatus } from "@/lib/cinetpay";
import { applyPlanToShop } from "@/lib/subscription";

/**
 * Webhook de notification CinetPay pour les paiements d'abonnement —
 * implémentation réelle du 15/09/2026 (compte marchand d'Isaac validé, voir
 * decisions-techniques.md). Remplace le stub posé précédemment (payload
 * jamais vérifié, statut jamais confirmé).
 *
 * Règles de sécurité issues de la doc officielle CinetPay
 * (https://docs.cinetpay.com/api/1.0-fr/checkout/notification), suivies à
 * la lettre :
 * - CinetPay envoie ce webhook en `application/x-www-form-urlencoded`, PAS
 *   en JSON — d'où `request.formData()` plutôt que `request.json()`.
 * - Le webhook peut être appelé PLUSIEURS FOIS pour la même transaction —
 *   traitement idempotent obligatoire (voir la vérification `payment.status
 *   === "success"` plus bas).
 * - On ne fait JAMAIS confiance au statut annoncé dans le payload reçu : on
 *   rappelle systématiquement l'API de vérification CinetPay
 *   (`checkCinetPayTransactionStatus`) avec NOTRE propre apikey/site_id
 *   pour obtenir le statut réel avant d'activer quoi que ce soit.
 * - Toujours répondre 200, sans redirection — sinon CinetPay considère la
 *   notification en échec et réessaie indéfiniment.
 *
 * Cette route est un webhook serveur-à-serveur : `createServiceRoleClient`
 * est le bon choix ici (pas de session utilisateur, pas de cookies) — même
 * pattern que les autres écritures de paiement du projet.
 */
export async function POST(request: NextRequest) {
  const supabase = createServiceRoleClient();

  let transactionId: string | null = null;
  try {
    const formData = await request.formData();
    transactionId = String(formData.get("cpm_trans_id") ?? "") || null;
  } catch (error) {
    console.error("CinetPay webhook — payload illisible:", error);
  }

  if (!transactionId) {
    // Toujours 200 : CinetPay ne doit jamais recevoir d'erreur qui le
    // pousserait à réessayer indéfiniment un payload qu'on ne peut de toute
    // façon pas traiter.
    return NextResponse.json({ received: true });
  }

  const { data: payment } = await supabase
    .from("payments")
    .select("id, shop_id, status, intent_plan_code")
    .eq("provider_transaction_id", transactionId)
    .maybeSingle();

  if (!payment || !payment.shop_id || !payment.intent_plan_code) {
    // Transaction inconnue de notre côté (jamais initiée par
    // initiateSubscriptionPayment) — rien à activer, mais on répond quand
    // même 200 pour ne pas déclencher de réessais CinetPay sur un cas qui
    // ne se résoudra jamais.
    console.error("CinetPay webhook — transaction inconnue:", transactionId);
    return NextResponse.json({ received: true });
  }

  // Idempotence : la doc CinetPay prévient explicitement que ce webhook peut
  // être appelé plusieurs fois pour la même transaction — un paiement déjà
  // confirmé ne doit pas réactiver/réinitialiser l'abonnement une seconde fois.
  if (payment.status === "success") {
    return NextResponse.json({ received: true });
  }

  // Étape obligatoire : on ne fait confiance qu'à cette vérification, jamais
  // au contenu du payload webhook lui-même.
  const verification = await checkCinetPayTransactionStatus(transactionId);

  if (verification.status === "ACCEPTED") {
    const result = await applyPlanToShop(supabase, payment.shop_id, payment.intent_plan_code);

    await supabase
      .from("payments")
      .update({
        status: "success",
        raw_payload: verification.raw,
      })
      .eq("id", payment.id);

    await supabase.from("transaction_logs").insert({
      actor_id: null,
      shop_id: payment.shop_id,
      action: "subscription_payment_success",
      metadata: {
        plan: payment.intent_plan_code,
        transaction_id: transactionId,
        applied: Boolean(result),
      },
    });
  } else if (verification.status === "REFUSED") {
    await supabase
      .from("payments")
      .update({ status: "failed", raw_payload: verification.raw })
      .eq("id", payment.id);

    await supabase.from("transaction_logs").insert({
      actor_id: null,
      shop_id: payment.shop_id,
      action: "subscription_payment_failed",
      metadata: { plan: payment.intent_plan_code, transaction_id: transactionId },
    });
  }
  // PENDING / UNKNOWN : on ne fait rien, le webhook sera probablement
  // rappelé plus tard par CinetPay avec un statut définitif.

  return NextResponse.json({ received: true });
}
