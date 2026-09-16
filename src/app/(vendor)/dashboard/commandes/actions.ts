"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleShop } from "@/lib/shop-access";
import { sendOrderStatusEmail } from "@/lib/email/order-notifications";

const STATUSES = ["pending", "paid", "preparing", "delivered", "cancelled"] as const;

/**
 * Change le statut d'une commande — vérifie que le vendeur possède bien la
 * boutique concernée OU qu'il y est collaborateur actif (plan Pro, ajouté le
 * 16/09/2026, voir src/lib/shop-access.ts), puis notifie le client par email
 * si celui-ci en a fourni un au moment de la commande (voir "Notifications
 * client automatiques" dans decisions-techniques.md — pas de champ email ->
 * simplement pas d'email envoyé, jamais bloquant).
 */
export async function updateOrderStatus(orderId: string, status: string) {
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const access = await getAccessibleShop(supabase, user.id);
  if (!access) return;

  const { data: order } = await supabase
    .from("orders")
    .select("id, shop_id, customer_email, customer_name, shops!inner(name, slug)")
    .eq("id", orderId)
    .eq("shop_id", access.shopId)
    .maybeSingle();

  if (!order) return;

  await supabase
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", orderId);

  revalidatePath("/dashboard/commandes");
  revalidatePath(`/dashboard/commandes/${orderId}`);

  const shop = Array.isArray(order.shops) ? order.shops[0] : order.shops;
  if (shop) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    // Best-effort, ne doit jamais faire échouer le changement de statut
    // lui-même — déjà appliqué en base à ce stade.
    sendOrderStatusEmail({
      customerEmail: order.customer_email,
      customerName: order.customer_name,
      shopName: shop.name,
      status,
      orderUrl: `${siteUrl}/${shop.slug}/commande/${orderId}`,
    }).catch(() => {});
  }
}
