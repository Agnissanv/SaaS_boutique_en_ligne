"use server";

import { redirect } from "next/navigation";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import {
  createNyoleCheckoutSession,
  grossUpAmountForNyoleCommission,
  isNyolePaymentsEnabled,
} from "@/lib/nyole";

export type InitiatePaymentState = {
  error?: string;
};

/**
 * Démarre un paiement Nyole réel pour passer d'un plan à un autre — bascule
 * du 28/09/2026 depuis CinetPay (remplacé en totalité, voir
 * src/lib/nyole.ts et decisions-techniques.md). Le vendeur choisit son plan
 * sur /dashboard/abonnement, cette action crée la tentative en base PUIS
 * redirige vers la page de paiement hébergée par Nyole — l'activation
 * réelle du plan n'a jamais lieu ici, seulement à la confirmation du
 * paiement par /api/nyole/webhook (jamais sur la seule foi d'un retour
 * navigateur, qui peut être falsifié ou interrompu).
 *
 * Contrairement à CinetPay, qui exigeait qu'on choisisse nous-mêmes
 * l'identifiant de transaction (`merchant_transaction_id`) avant même
 * d'appeler l'API, Nyole attribue son propre identifiant de session à la
 * création (`id`, ex. `cmf3k2p1x...`) : la ligne `payments` est donc
 * d'abord créée avec un identifiant temporaire généré ici (uniquement pour
 * satisfaire la contrainte d'unicité sur `provider_transaction_id` et
 * servir de clé `Idempotency-Key` côté Nyole), puis mise à jour avec le
 * véritable identifiant de session Nyole une fois connu — c'est ce dernier
 * que le webhook retrouvera dans `data.id` pour faire la correspondance.
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
  // Coupe-circuit optionnel — voir le commentaire sur `isNyolePaymentsEnabled`
  // dans nyole.ts. Vérifié avant toute écriture en base : inutile de créer
  // une tentative de paiement qu'on sait déjà vouée à l'échec.
  if (!isNyolePaymentsEnabled()) {
    return {
      error:
        "Le paiement en ligne est temporairement indisponible. Contacte-nous pour mettre à niveau ton abonnement.",
    };
  }

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
  // Sert uniquement de valeur temporaire unique pour `provider_transaction_id`
  // (contrainte 0017_cinetpay_subscription_payments.sql) et de clé
  // `Idempotency-Key` côté Nyole — remplacée ci-dessous par l'identifiant de
  // session réel de Nyole dès qu'il est connu.
  const transactionId = `sub-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

  // Majoration pour que la commission Nyole soit supportée par le vendeur
  // (le payeur ici), pas par KEVA — voir `grossUpAmountForNyoleCommission`
  // dans src/lib/nyole.ts (demande explicite d'Isaac, 29/09/2026). Le
  // vendeur voit donc un montant légèrement supérieur au prix affiché
  // (2500/7000 FCFA) sur la page Nyole, et c'est CE montant qu'on enregistre
  // dans `payments.amount` — c'est réellement ce qui a été facturé, la
  // réconciliation doit s'y référer, pas au prix catalogue.
  const chargedAmount = grossUpAmountForNyoleCommission(plan.price);

  // Enregistré AVANT d'afficher le guichet (même précaution que pour
  // CinetPay) : c'est cette ligne, retrouvée par `provider_transaction_id`,
  // qui dit au webhook QUEL plan activer pour QUELLE boutique une fois le
  // paiement confirmé — jamais une donnée lue depuis le webhook lui-même.
  const { error: insertError } = await serviceRole.from("payments").insert({
    shop_id: shop.id,
    provider: "nyole",
    provider_transaction_id: transactionId,
    intent_plan_code: plan.code,
    amount: chargedAmount,
    currency: "XOF",
    status: "pending",
  });

  if (insertError) {
    console.error("initiateSubscriptionPayment — erreur insertion payments:", insertError);
    return { error: "Impossible de démarrer le paiement. Réessaie." };
  }

  const result = await createNyoleCheckoutSession({
    idempotencyKey: transactionId,
    amount: chargedAmount,
    description: `Abonnement KEVA — Plan ${plan.name} (frais de transaction inclus)`,
    successUrl: `${siteUrl}/dashboard/abonnement?paiement=succes`,
    cancelUrl: `${siteUrl}/dashboard/abonnement?paiement=echec`,
    customerEmail: user.email ?? undefined,
    customerName: profile?.display_name ?? undefined,
    metadata: { order_id: transactionId },
  });

  if (!result.ok) {
    await serviceRole
      .from("payments")
      .update({ status: "failed" })
      .eq("provider_transaction_id", transactionId);
    return { error: result.error };
  }

  // Remplace notre identifiant temporaire par celui attribué par Nyole à la
  // création (`data.id` du webhook correspondra à cette même valeur) — voir
  // le raisonnement complet en tête de fichier.
  await serviceRole
    .from("payments")
    .update({ provider_transaction_id: result.id })
    .eq("provider_transaction_id", transactionId);

  redirect(result.url);
}
