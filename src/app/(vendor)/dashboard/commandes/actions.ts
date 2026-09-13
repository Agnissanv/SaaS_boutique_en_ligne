"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const STATUSES = ["pending", "paid", "preparing", "delivered", "cancelled"] as const;

/** Change le statut d'une commande — vérifie que le vendeur possède bien la boutique concernée. */
export async function updateOrderStatus(orderId: string, status: string) {
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: order } = await supabase
    .from("orders")
    .select("id, shop_id, shops!inner(owner_id)")
    .eq("id", orderId)
    .eq("shops.owner_id", user.id)
    .maybeSingle();

  if (!order) return;

  await supabase
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", orderId);

  revalidatePath("/dashboard/commandes");
  revalidatePath(`/dashboard/commandes/${orderId}`);
}
