"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
 * Manuel plutôt que via paiement CinetPay : le compte marchand d'Isaac est
 * encore en attente de validation (voir decisions-techniques.md). En
 * attendant, un vendeur qui paie autrement (ex: virement Wave direct à
 * Isaac) peut être passé en Essentiel/Pro à la main ici — solution de
 * transition assumée, pas une confirmation automatique de paiement.
 */
export async function assignPlan(shopId: string, planCode: string) {
  const admin = await requireAdmin();
  if (!admin) return;
  const { supabase, userId } = admin;

  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("id, code, duration_days")
    .eq("code", planCode)
    .maybeSingle();

  if (!plan) return;

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("shop_id", shopId)
    .maybeSingle();

  const expiresAt = new Date(Date.now() + plan.duration_days * 24 * 60 * 60 * 1000).toISOString();

  if (existing) {
    await supabase
      .from("subscriptions")
      .update({
        plan_id: plan.id,
        status: "active",
        started_at: new Date().toISOString(),
        expires_at: expiresAt,
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("subscriptions").insert({
      shop_id: shopId,
      plan_id: plan.id,
      status: "active",
      started_at: new Date().toISOString(),
      expires_at: expiresAt,
    });
  }

  await supabase.from("transaction_logs").insert({
    actor_id: userId,
    shop_id: shopId,
    action: "subscription_plan_assigned",
    metadata: { plan: plan.code },
  });

  revalidatePath("/admin/abonnements");
}
