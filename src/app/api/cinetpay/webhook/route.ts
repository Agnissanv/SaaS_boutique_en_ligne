import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { checkCinetPayTransactionStatus } from "@/lib/cinetpay";
import { applyPlanToShop } from "@/lib/subscription";

/**
 * Webhook de notification CinetPay pour les paiements d'abonnement —
 * réécrit le 15/09/2026 après avoir découvert que le compte réel d'Isaac
 * tourne sur une version plus récente de l'API que celle initialement
 * documentée (voir decisions-techniques.md et cinetpay.ts). Deux différences
 * majeures avec la première version de ce fichier :
 * - Le corps est du JSON (pas `application/x-www-form-urlencoded`).
 * - Le payload ne contient PAS de statut — seulement des identifiants
 *   (`notify_token`, `merchant_transaction_id`, `transaction_id`) et les
 *   infos du client. Il n'y a donc même pas de tentation de lire un faux
 *   statut : on va toujours chercher le statut réel nous-mêmes.
 *
 * Règles de sécurité — copiées de la page "Notification de transaction" de
 * la documentation intégrée au compte d'Isaac ("Avertissement sécurité — À
 * LIRE EN PREMIER") :
 * - "Ne faites JAMAIS confiance au statut transmis dans le webhook." N'importe
 *   qui connaissant l'URL (publique par nature) peut forger un appel.
 * - Règle d'or : à chaque réception, on appelle immédiatement
 *   `GET /v1/payment/{merchant_transaction_id}` pour obtenir le statut
 *   canonique signé par CinetPay — jamais une donnée du payload entrant.
 * - En plus de ça, on compare le `notify_token` reçu à celui qu'on a stocké
 *   nous-mêmes lors de l'initialisation (`initiateSubscriptionPayment`) —
 *   une vérification d'authenticité supplémentaire, recommandée par leur
 *   doc, qui rejette une notification forgée avant même de dépenser un appel
 *   à l'API de vérification.
 * - Toujours répondre 200 sous 10 secondes, sans redirection, même en cas
 *   d'erreur de notre côté — sinon CinetPay retente indéfiniment (back-off
 *   1 min, 5 min, 30 min, 2h, 6h...).
 * - Traitement idempotent obligatoire : une notification peut être livrée
 *   plusieurs fois pour la même transaction.
 *
 * Cette route est un webhook serveur-à-serveur : `createServiceRoleClient`
 * est le bon choix ici (pas de session utilisateur, pas de cookies) — même
 * pattern que les autres écritures de paiement du projet.
 */
export async function POST(request: NextRequest) {
  const supabase = createServiceRoleClient();

  let payload: Record<string, unknown> | null = null;
  try {
    payload = await request.json();
  } catch (error) {
    console.error("CinetPay webhook — payload JSON illisible:", error);
  }

  const merchantTransactionId =
    typeof payload?.merchant_transaction_id === "string" ? payload.merchant_transaction_id : null;
  const notifyToken = typeof payload?.notify_token === "string" ? payload.notify_token : null;

  if (!merchantTransactionId) {
    // Toujours 200 : CinetPay ne doit jamais recevoir d'erreur qui le
    // pousserait à réessayer indéfiniment un payload qu'on ne peut de toute
    // façon pas traiter.
    return NextResponse.json({ received: true });
  }

  const { data: payment } = await supabase
    .from("payments")
    .select("id, shop_id, status, intent_plan_code, provider_notify_token")
    .eq("provider_transaction_id", merchantTransactionId)
    .maybeSingle();

  if (!payment || !payment.shop_id || !payment.intent_plan_code) {
    // Transaction inconnue de notre côté (jamais initiée par
    // initiateSubscriptionPayment) — rien à activer, mais on répond quand
    // même 200 pour ne pas déclencher de réessais CinetPay sur un cas qui
    // ne se résoudra jamais.
    console.error("CinetPay webhook — transaction inconnue:", merchantTransactionId);
    return NextResponse.json({ received: true });
  }

  // Vérification d'authenticité recommandée par CinetPay, EN PLUS de la
  // vérification de statut ci-dessous (qui reste, elle, obligatoire) — un
  // jeton qui ne correspond pas signifie que cet appel n'a pas été déclenché
  // par notre propre initialisation de paiement.
  if (payment.provider_notify_token && payment.provider_notify_token !== notifyToken) {
    console.error(
      "CinetPay webhook — notify_token invalide pour la transaction:",
      merchantTransactionId
    );
    return NextResponse.json({ received: true });
  }

  // Idempotence : une notification peut être livrée plusieurs fois pour la
  // même transaction — un paiement déjà confirmé ne doit pas réactiver
  // l'abonnement une seconde fois.
  if (payment.status === "success") {
    return NextResponse.json({ received: true });
  }

  // Étape obligatoire : on ne fait confiance qu'à cette vérification, jamais
  // au contenu du payload webhook lui-même (qui, dans cette version de
  // l'API, ne contient de toute façon aucun statut).
  const verification = await checkCinetPayTransactionStatus(merchantTransactionId);

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
        transaction_id: merchantTransactionId,
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
      metadata: { plan: payment.intent_plan_code, transaction_id: merchantTransactionId },
    });
  }
  // PENDING / UNKNOWN : on ne fait rien, le webhook sera probablement
  // rappelé plus tard par CinetPay avec un statut définitif.

  return NextResponse.json({ received: true });
}

/**
 * CinetPay recommande d'accepter aussi le GET sur la même URL : une sonde de
 * santé envoyée avant la première vraie notification, pour vérifier que
 * l'endpoint est joignable. Un corps vide avec 200 suffit.
 */
export async function GET() {
  return NextResponse.json({ received: true });
}
