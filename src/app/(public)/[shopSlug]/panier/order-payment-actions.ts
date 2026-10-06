"use server";

import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  createNyoleCheckoutSession,
  grossUpAmountForNyoleCommission,
  isNyolePaymentsEnabled,
} from "@/lib/nyole";

export type InitiateOrderPaymentState = {
  error?: string;
};

/**
 * Démarre le paiement en ligne (Nyole) d'une commande client — ajouté le
 * 29/09/2026, suite directe de la bascule Nyole des abonnements (même
 * fichier de référence : dashboard/abonnement/actions.ts). Jusqu'ici,
 * `create_order` acceptait déjà `payment_method = 'mobile_money'` en base
 * mais l'option était désactivée côté UI (cart-checkout.tsx) faute
 * d'agrégateur branché sur le checkout — voir decisions-techniques.md.
 *
 * Appelée juste après un `create_order` réussi (voir cart-checkout.tsx),
 * jamais avant : la commande doit déjà exister (stock décrémenté, montant
 * total calculé avec remise/livraison) avant qu'on sache combien facturer.
 *
 * Client (pas de compte requis) : lue via le client service role, comme
 * `initiateSubscriptionPayment` — aucune session utilisateur fiable ici (un
 * client peut commander sans compte), et `payments`/`orders` n'ont de toute
 * façon aucune policy d'écriture cliente pour cette table (voir 0001_init.sql).
 * L'appartenance de la commande à CETTE boutique n'a pas besoin d'être
 * revérifiée : `orderId` est l'UUID non devinable retourné par `create_order`
 * lui-même (même "jeton de capacité" que `cancel_order`/`get_order_receipt`).
 *
 * Majoration Nyole : voir `grossUpAmountForNyoleCommission` dans
 * src/lib/nyole.ts — le CLIENT paie la commission Nyole en plus du total
 * affiché ("100% pour le vendeur, on ne touche pas à sa commission", Isaac),
 * mais `payments.amount` (utile pour la réconciliation) et le crédit du
 * portefeuille vendeur (voir `creditVendorWalletForPaidOrder`, appelée par
 * le webhook) restent basés sur `orders.total_amount`, le vrai montant de la
 * commande — jamais le montant majoré.
 */
export async function initiateOrderPayment(orderId: string): Promise<InitiateOrderPaymentState> {
  if (!isNyolePaymentsEnabled()) {
    return {
      error: "Le paiement en ligne est temporairement indisponible. Contacte le vendeur.",
    };
  }

  const serviceRole = createServiceRoleClient();

  const { data: order } = await serviceRole
    .from("orders")
    .select(
      "id, shop_id, status, payment_method, total_amount, customer_name, customer_email, customer_phone, shops!inner(name, slug)"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (!order) {
    return { error: "Commande introuvable." };
  }

  if (order.payment_method !== "mobile_money") {
    return { error: "Cette commande n'est pas configurée pour le paiement en ligne." };
  }

  // Idempotence côté commande : si elle est déjà payée (webhook déjà passé,
  // ou double-clic du client), pas de raison de recréer une session — évite
  // aussi qu'un client double-paie la même commande.
  if (order.status !== "pending") {
    return { error: "Cette commande n'est plus en attente de paiement." };
  }

  const shop = Array.isArray(order.shops) ? order.shops[0] : order.shops;
  if (!shop) {
    return { error: "Boutique introuvable." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const orderUrl = `${siteUrl}/${shop.slug}/commande/${orderId}`;

  // Valeur temporaire unique, remplacée ci-dessous par l'identifiant de
  // session réel de Nyole — même pattern que initiateSubscriptionPayment.
  const transactionId = `ord-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

  const chargedAmount = grossUpAmountForNyoleCommission(order.total_amount);

  const { error: insertError } = await serviceRole.from("payments").insert({
    shop_id: order.shop_id,
    order_id: order.id,
    provider: "nyole",
    provider_transaction_id: transactionId,
    amount: chargedAmount,
    currency: "XOF",
    status: "pending",
  });

  if (insertError) {
    console.error("initiateOrderPayment — erreur insertion payments:", insertError);
    return { error: "Impossible de démarrer le paiement. Réessaie." };
  }

  const result = await createNyoleCheckoutSession({
    idempotencyKey: transactionId,
    amount: chargedAmount,
    description: `${shop.name} — commande KEVA (frais de transaction inclus)`,
    successUrl: orderUrl,
    cancelUrl: orderUrl,
    customerEmail: order.customer_email ?? undefined,
    customerName: order.customer_name ?? undefined,
    customerPhone: order.customer_phone ?? undefined,
    metadata: { order_id: transactionId },
  });

  if (!result.ok) {
    await serviceRole
      .from("payments")
      .update({ status: "failed" })
      .eq("provider_transaction_id", transactionId);
    return { error: result.error };
  }

  await serviceRole
    .from("payments")
    .update({ provider_transaction_id: result.id })
    .eq("provider_transaction_id", transactionId);

  redirect(result.url);
}
