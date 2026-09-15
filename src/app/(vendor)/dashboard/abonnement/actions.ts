"use server";

import { redirect } from "next/navigation";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { initiateCinetPayPayment } from "@/lib/cinetpay";

export type InitiatePaymentState = {
  error?: string;
};

/**
 * Démarre un paiement CinetPay réel pour passer d'un plan à un autre
 * (spec du 15/09/2026 — Isaac a confirmé que le compte marchand est
 * maintenant validé). Le vendeur choisit son plan sur /dashboard/abonnement,
 * cette action crée la tentative en base PUIS redirige vers le guichet
 * CinetPay — l'activation réelle du plan n'a jamais lieu ici, seulement à
 * la confirmation du paiement par /api/cinetpay/webhook (jamais sur la
 * seule foi d'un retour navigateur, qui peut être falsifié ou interrompu).
 *
 * Écrit dans `payments` via le client service role plutôt que le client
 * authentifié : `payments` n'a qu'une policy RLS de LECTURE (voir
 * 0001_init.sql, "payments_owner_read") — aucune policy d'écriture pour un
 * vendeur, par choix de sécurité du projet (voir la note dans
 * 0001_init.sql : les écritures de paiement passent par un service role,
 * jamais un insert direct depuis le navigateur). L'appartenance de la
 * boutique est vérifiée juste avant, via le client authentifié.
 */
export async function initiateSubscriptionPayment(
  _prevState: InitiatePaymentState,
  formData: FormData
): Promise<InitiatePaymentState> {
  const planCode = String(formData.get("planCode") ?? "");
  if (!planCode) {
    return { error: "Plan invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Session expirée, reconnecte-toi." };
  }

  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!shop) {
    return { error: "Crée d'abord ta boutique." };
  }

  const serviceRole = createServiceRoleClient();

  const { data: plan } = await serviceRole
    .from("subscription_plans")
    .select("code, name, price")
    .eq("code", planCode)
    .maybeSingle();

  if (!plan) {
    return { error: "Plan introuvable." };
  }

  if (plan.price <= 0) {
    return { error: "Ce plan est gratuit, aucun paiement nécessaire." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const transactionId = `sub-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

  // Enregistré AVANT d'afficher le guichet (recommandation officielle
  // CinetPay) : c'est cette ligne, retrouvée par `provider_transaction_id`,
  // qui dit au webhook QUEL plan activer pour QUELLE boutique une fois le
  // paiement confirmé — jamais une donnée lue depuis le webhook lui-même.
  const { error: insertError } = await serviceRole.from("payments").insert({
    shop_id: shop.id,
    provider: "cinetpay",
    provider_transaction_id: transactionId,
    intent_plan_code: plan.code,
    amount: plan.price,
    currency: "XOF",
    status: "pending",
  });

  if (insertError) {
    console.error("initiateSubscriptionPayment — erreur insertion payments:", insertError);
    return { error: "Impossible de démarrer le paiement. Réessaie." };
  }

  const result = await initiateCinetPayPayment({
    transactionId,
    amount: plan.price,
    description: `Abonnement KEVA — Plan ${plan.name}`,
    notifyUrl: `${siteUrl}/api/cinetpay/webhook`,
    returnUrl: `${siteUrl}/dashboard/abonnement?paiement=retour`,
    metadata: shop.id,
  });

  if (!result.ok) {
    await serviceRole
      .from("payments")
      .update({ status: "failed" })
      .eq("provider_transaction_id", transactionId);
    return { error: result.error };
  }

  redirect(result.paymentUrl);
}
