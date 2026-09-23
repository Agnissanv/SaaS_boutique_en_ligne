"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { applyPlanToShop } from "@/lib/subscription";
import { maybeGrantReferralReward } from "@/lib/referrals";
import { maybeCreditCommercialCommission } from "@/lib/commercial-referrals";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return profile?.role === "admin" ? { supabase, userId: user.id } : null;
}

// Durée en mois proposée dans le sélecteur admin (plan-select.tsx) —
// convertie en jours sur la base de 30 jours/mois, cohérente avec
// `duration_days = 30` déjà utilisé pour un mois "normal" partout ailleurs
// dans le projet (0001_init.sql, 0016_subscription_plans_v2.sql) plutôt que
// des mois calendaires de longueur variable.
const DAYS_PER_MONTH = 30;

/**
 * Assigne/change manuellement le plan d'abonnement d'une boutique
 * (cahier des charges §3.1.C.3 — "Gestion des abonnements").
 *
 * Reste utile même maintenant que le paiement CinetPay réel est branché
 * (voir /api/cinetpay/webhook) : un vendeur qui paie autrement (virement
 * Wave direct à Isaac, geste commercial, etc.) peut toujours être passé sur
 * un plan à la main ici. La logique d'application du plan elle-même
 * (`applyPlanToShop`, src/lib/subscription.ts) est désormais partagée avec
 * le webhook de paiement — un seul endroit, pas deux implémentations qui
 * pourraient diverger.
 *
 * `durationMonths` (23/09/2026) — question directe d'Isaac : en attendant
 * PawaPay, l'encaissement se fait manuellement, et un vendeur peut très bien
 * payer plusieurs mois d'un coup. `undefined`/`1` retombe sur le
 * comportement d'origine (30 jours, la valeur `duration_days` du plan) ;
 * toute autre valeur passe une durée explicite à `applyPlanToShop`.
 */
export async function assignPlan(shopId: string, planCode: string, durationMonths?: number) {
  const admin = await requireAdmin();
  if (!admin) return;
  const { supabase, userId } = admin;

  const durationDays =
    durationMonths && durationMonths > 1 ? durationMonths * DAYS_PER_MONTH : undefined;

  const result = await applyPlanToShop(supabase, shopId, planCode, durationDays);
  if (!result) return;

  // Système de parrainage (23/09/2026, voir src/lib/referrals.ts) : ce point
  // représente un vrai paiement confirmé (encaissement manuel par Isaac),
  // exactement le déclencheur choisi pour récompenser un éventuel parrain —
  // ne fait rien si cette boutique n'a pas de parrain ou si le plan assigné
  // est gratuit (Starter).
  await maybeGrantReferralReward(supabase, shopId, result.planId);

  // Parrainage COMMERCIAL (23/09/2026, voir src/lib/commercial-referrals.ts)
  // : même déclencheur (paiement confirmé), mécanique de récompense
  // différente (commission en argent réel, à chaque paiement) — ne fait
  // rien si cette boutique n'a pas été recrutée par un commercial.
  await maybeCreditCommercialCommission(supabase, shopId, result.planCode);

  await supabase.from("transaction_logs").insert({
    actor_id: userId,
    shop_id: shopId,
    action: "subscription_plan_assigned",
    // `duration_months` consigné pour garder une trace de ce qui a
    // réellement été accordé (encaissement manuel) — 1 par défaut quand
    // aucune durée explicite n'a été choisie.
    metadata: { plan: result.planCode, duration_months: durationMonths ?? 1 },
  });

  if (result.deactivatedProductIds.length > 0) {
    await supabase.from("transaction_logs").insert({
      actor_id: userId,
      shop_id: shopId,
      action: "products_deactivated_over_plan_limit",
      metadata: {
        plan: result.planCode,
        count: result.deactivatedProductIds.length,
      },
    });
  }

  revalidatePath("/admin/abonnements");
  revalidatePath("/dashboard/produits");
}
