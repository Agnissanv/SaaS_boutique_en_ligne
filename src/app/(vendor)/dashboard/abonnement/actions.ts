"use server";

import { redirect } from "next/navigation";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { initiateCinetPayPayment } from "@/lib/cinetpay";

export type InitiatePaymentState = {
  error?: string;
};

/**
 * CinetPay ("1.0 Aurora") exige `client_first_name` / `client_last_name`,
 * chacun avec au moins 2 caractères — des champs qu'on n'a pas séparément en
 * base (`profiles.display_name` est un champ unique). On les dérive du nom
 * affiché du vendeur, avec repli sur "Client" si vide/trop court.
 */
function splitDisplayName(displayName: string | null | undefined) {
  const parts = (displayName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
  }
  const single = parts[0] && parts[0].length >= 2 ? parts[0] : "Client";
  return { firstName: single, lastName: single };
}

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

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

  const { firstName, lastName } = splitDisplayName(profile?.display_name);

  const result = await initiateCinetPayPayment({
    transactionId,
    amount: plan.price,
    description: `Abonnement KEVA — Plan ${plan.name}`,
    notifyUrl: `${siteUrl}/api/cinetpay/webhook`,
    successUrl: `${siteUrl}/dashboard/abonnement?paiement=succes`,
    failedUrl: `${siteUrl}/dashboard/abonnement?paiement=echec`,
    clientEmail: user.email ?? "client@keva.app",
    clientFirstName: firstName,
    clientLastName: lastName,
  });

  if (!result.ok) {
    await serviceRole
      .from("payments")
      .update({ status: "failed" })
      .eq("provider_transaction_id", transactionId);
    return { error: result.error };
  }

  // Stocké pour que le webhook puisse authentifier la notification reçue
  // (comparaison de `notify_token`) avant même d'appeler l'API de
  // vérification — voir 0018_cinetpay_notify_token.sql.
  await serviceRole
    .from("payments")
    .update({ provider_notify_token: result.notifyToken })
    .eq("provider_transaction_id", transactionId);

  redirect(result.paymentUrl);
}
