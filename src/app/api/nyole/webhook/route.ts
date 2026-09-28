import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { verifyNyoleWebhookSignature } from "@/lib/nyole";
import { applyPlanToShop } from "@/lib/subscription";
import { maybeGrantReferralReward } from "@/lib/referrals";
import { maybeCreditCommercialCommission } from "@/lib/commercial-referrals";
import { resolveNotificationEmail } from "@/lib/subscription-lifecycle";
import { sendSubscriptionPaymentReceiptEmail } from "@/lib/email/subscription-payment-receipt";

// Route Handler Node (jamais Edge) — nécessaire pour `node:crypto` utilisé
// par `verifyNyoleWebhookSignature`. Explicite plutôt que de compter sur le
// défaut Next.js, pour ne jamais casser silencieusement si ce défaut change.
export const runtime = "nodejs";

/**
 * Webhook de notification Nyole pour les paiements d'abonnement — remplace
 * /api/cinetpay/webhook le 28/09/2026 (bascule complète vers Nyole, voir
 * src/lib/nyole.ts pour le détail du contrat).
 *
 * Sécurité — algorithme documenté sur la page "Vérifier la signature" de
 * nyole.com/docs/ : `X-Afriflow-Timestamp` + `X-Afriflow-Signature`
 * (HMAC-SHA256 du corps brut, comparaison en temps constant, rejet au-delà
 * de 5 minutes). Le corps DOIT être lu en texte brut (`request.text()`)
 * avant tout `JSON.parse` — un corps reparsé puis re-sérialisé ne donnerait
 * pas le même HMAC que celui calculé par Nyole sur l'octet-stream original.
 *
 * Contrairement à CinetPay (webhook non signé, statut jamais fiable sans un
 * second appel GET de vérification), Nyole signe chaque webhook : une fois
 * la signature vérifiée, son propre statut fait foi (voir le raisonnement
 * complet en tête de src/lib/nyole.ts) — pas de second appel réseau
 * obligatoire ici avant de créditer.
 *
 * Correspondance de la transaction : Nyole attribue lui-même l'identifiant
 * de session (`data.id`) à la création — c'est cet identifiant, renvoyé par
 * `createNyoleCheckoutSession` et stocké comme `provider_transaction_id`
 * (voir dashboard/abonnement/actions.ts), qui permet de retrouver la ligne
 * `payments` correspondante. Pas de jeton d'authenticité séparé à comparer
 * (CinetPay avait `notify_token` pour pallier l'absence de signature).
 *
 * Toujours répondre vite (Nyole attend une réponse sous 10 secondes, sinon
 * retente jusqu'à 10 fois sur ~72h) et traiter idempotent : le même
 * événement peut être livré plusieurs fois.
 *
 * Route serveur-à-serveur : `createServiceRoleClient` est le bon choix ici
 * (pas de session utilisateur, pas de cookies) — même pattern que le reste
 * du projet pour les écritures de paiement.
 *
 * Email de confirmation (29/09/2026) : `payment.completed` déclenche aussi
 * `sendSubscriptionPaymentReceiptEmail` (voir
 * email/subscription-payment-receipt.ts) — best-effort, jamais bloquant.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const secret = process.env.NYOLE_SECRET_KEY;
  if (!secret) {
    console.error("Nyole webhook — NYOLE_SECRET_KEY manquante, impossible de vérifier la signature.");
    return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  }

  const isValid = await verifyNyoleWebhookSignature({
    rawBody,
    timestampHeader: request.headers.get("x-afriflow-timestamp"),
    signatureHeader: request.headers.get("x-afriflow-signature"),
    secret,
  });

  if (!isValid) {
    console.error("Nyole webhook — signature invalide ou manquante.");
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  let payload: {
    event?: string;
    data?: {
      id?: string;
      status?: string;
      metadata?: Record<string, unknown>;
      order_id?: string;
      amount?: number;
      currency?: string;
    };
  } | null = null;
  try {
    payload = JSON.parse(rawBody);
  } catch (error) {
    console.error("Nyole webhook — payload JSON illisible:", error);
    return NextResponse.json({ received: true });
  }

  const event = payload?.event;
  const sessionId = payload?.data?.id;

  if (!sessionId) {
    return NextResponse.json({ received: true });
  }

  const supabase = createServiceRoleClient();

  const { data: payment } = await supabase
    .from("payments")
    .select("id, shop_id, status, intent_plan_code, amount, currency")
    .eq("provider_transaction_id", sessionId)
    .maybeSingle();

  if (!payment || !payment.shop_id || !payment.intent_plan_code) {
    // Transaction inconnue de notre côté (jamais initiée par
    // initiateSubscriptionPayment, ou pas encore mise à jour avec son
    // provider_transaction_id) — rien à activer.
    console.error("Nyole webhook — transaction inconnue:", sessionId);
    return NextResponse.json({ received: true });
  }

  // Idempotence : un événement peut être livré plusieurs fois — un paiement
  // déjà confirmé ne doit pas réactiver l'abonnement une seconde fois.
  if (payment.status === "success") {
    return NextResponse.json({ received: true });
  }

  if (event === "payment.completed") {
    const result = await applyPlanToShop(supabase, payment.shop_id, payment.intent_plan_code);

    // Système de parrainage (voir src/lib/referrals.ts) : un paiement Nyole
    // confirmé (webhook signé) est l'un des deux seuls déclencheurs de
    // récompense — ne fait rien si cette boutique n'a pas de parrain ou si
    // le plan assigné est gratuit.
    if (result) {
      await maybeGrantReferralReward(supabase, payment.shop_id, result.planId);
      // Parrainage commercial : commission en argent réel à chaque paiement
      // confirmé, voir src/lib/commercial-referrals.ts.
      await maybeCreditCommercialCommission(supabase, payment.shop_id, result.planCode);
    }

    await supabase
      .from("payments")
      .update({ status: "success", raw_payload: payload })
      .eq("id", payment.id);

    await supabase.from("transaction_logs").insert({
      actor_id: null,
      shop_id: payment.shop_id,
      action: "subscription_payment_success",
      metadata: {
        plan: payment.intent_plan_code,
        transaction_id: sessionId,
        applied: Boolean(result),
      },
    });

    // Email de confirmation KEVA (29/09/2026) — voir
    // email/subscription-payment-receipt.ts pour le raisonnement complet.
    // Best-effort, ne doit jamais faire échouer le webhook : le plan est
    // déjà activé ci-dessus, un email manqué n'est qu'une notification
    // ratée, jamais une activation ratée.
    if (result) {
      try {
        const { data: shop } = await supabase
          .from("shops")
          .select("name, notification_email, owner_id")
          .eq("id", payment.shop_id)
          .maybeSingle();

        if (shop) {
          const email = await resolveNotificationEmail(supabase, shop);
          if (email) {
            await sendSubscriptionPaymentReceiptEmail({
              to: email,
              shopName: shop.name,
              planName: result.planName,
              amount: payload?.data?.amount ?? payment.amount,
              currency: payload?.data?.currency ?? payment.currency,
              reference: payload?.data?.order_id ?? sessionId,
              expiresAt: result.expiresAt,
            });
          }
        }
      } catch (error) {
        console.error("Nyole webhook — échec envoi email de confirmation:", error);
      }
    }
  } else if (event === "payment.failed" || event === "payment.cancelled") {
    // `payments.status` n'a que trois valeurs possibles (pending/success/
    // failed, voir 0001_init.sql) — un paiement annulé par le client est
    // traité comme un échec, dans les deux cas le vendeur peut simplement
    // relancer un paiement depuis /dashboard/abonnement.
    await supabase
      .from("payments")
      .update({ status: "failed", raw_payload: payload })
      .eq("id", payment.id);

    await supabase.from("transaction_logs").insert({
      actor_id: null,
      shop_id: payment.shop_id,
      action: "subscription_payment_failed",
      metadata: { plan: payment.intent_plan_code, transaction_id: sessionId },
    });
  }
  // payment.updated (remboursement, retour à PENDING...) : aucune valeur
  // `payments.status` ne correspond à ces cas, on se contente de journaliser
  // via le `console.error` implicite d'une transaction inconnue le cas
  // échéant — rien d'autre à faire ici pour l'instant.

  return NextResponse.json({ received: true });
}

/**
 * Nyole ne documente pas de sonde de santé GET comme CinetPay, mais répondre
 * 200 sur un GET reste une précaution inoffensive (ex. vérification manuelle
 * de l'URL depuis un navigateur).
 */
export async function GET() {
  return NextResponse.json({ received: true });
}
