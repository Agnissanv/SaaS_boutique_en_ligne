"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Vérifie que l'utilisateur connecté est bien admin (RLS l'impose déjà côté
 * base, mais on double-vérifie ici pour ne pas dépendre uniquement de ça si
 * ces actions sont un jour réutilisées ailleurs). */
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

/** Active ou suspend une boutique (cahier des charges §3.1.C.2). */
export async function toggleShopStatus(shopId: string, nextStatus: "active" | "suspended") {
  const admin = await requireAdmin();
  if (!admin) return;
  const { supabase, userId } = admin;

  const { error } = await supabase
    .from("shops")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", shopId);

  if (!error) {
    await supabase.from("transaction_logs").insert({
      actor_id: userId,
      shop_id: shopId,
      action: nextStatus === "suspended" ? "shop_suspended" : "shop_activated",
      metadata: {},
    });
  }

  revalidatePath("/admin/vendeurs");
}

/**
 * Note libre admin sur une boutique — support basique (§3.1.C.5).
 *
 * Table séparée `shop_admin_notes` (pas une colonne sur `shops`) : RLS
 * s'applique par ligne, pas par colonne, donc une colonne `admin_notes` sur
 * `shops` resterait lisible/modifiable par le vendeur propriétaire via la
 * policy `shops_owner_all` — voir 0008_prevent_privilege_escalation.sql.
 */
export async function updateAdminNotes(shopId: string, notes: string) {
  const admin = await requireAdmin();
  if (!admin) return;
  const { supabase } = admin;

  await supabase.from("shop_admin_notes").upsert({
    shop_id: shopId,
    note: notes || null,
    updated_at: new Date().toISOString(),
  });

  revalidatePath("/admin/vendeurs");
}
