"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { applyPlanToShop } from "@/lib/subscription";

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
 */
export async function assignPlan(shopId: string, planCode: string) {
  const admin = await requireAdmin();
  if (!admin) return;
  const { supabase, userId } = admin;

  const result = await applyPlanToShop(supabase, shopId, planCode);
  if (!result) return;

  await supabase.from("transaction_logs").insert({
    actor_id: userId,
    shop_id: shopId,
    action: "subscription_plan_assigned",
    metadata: { plan: result.planCode },
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
