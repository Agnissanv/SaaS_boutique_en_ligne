"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleShop } from "@/lib/shop-access";
import { sendOrderStatusEmail } from "@/lib/email/order-notifications";
import { ORDER_STATUS_CUSTOMER_MESSAGE } from "@/lib/orders";

const STATUSES = ["pending", "paid", "preparing", "delivered", "cancelled"] as const;

/**
 * Change le statut d'une commande — vérifie que le vendeur possède bien la
 * boutique concernée OU qu'il y est collaborateur actif (plan Pro, ajouté le
 * 16/09/2026, voir src/lib/shop-access.ts), puis notifie le client par email
 * si celui-ci en a fourni un au moment de la commande (voir "Notifications
 * client automatiques" dans decisions-techniques.md — pas de champ email ->
 * simplement pas d'email envoyé, jamais bloquant).
 *
 * **Notification en base ajoutée le 21/09/2026** (espace de notification
 * unifié, demande d'Isaac) — en plus de l'email, qui reste best-effort et
 * réservé aux clients ayant fourni une adresse : celle-ci nécessite un
 * compte client (`orders.customer_id`, rempli seulement si le client était
 * connecté au moment de sa commande, cf. migration 0014) puisque la table
 * `notifications` est adressée par `profile_id`. Un client invité sans
 * compte ne reçoit donc que l'email (s'il en a fourni un) — c'est
 * exactement l'argument en faveur de proposer un compte après achat (voir
 * la bannière sur la page de confirmation de commande).
 *
 * "delivered" déclenche un message différent ("review_ready") plutôt que le
 * texte générique de changement de statut : "un client n'a pas le droit de
 * mettre son avis alors qu'il n'a pas encore touché le produit" (Isaac,
 * 21/09/2026) — voir aussi le garde-fou ajouté côté `submit_product_review`
 * (migration 0030) qui refuse tout avis avant ce statut.
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
    .select("id, shop_id, customer_id, customer_email, customer_name, shops!inner(name, slug)")
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
    const orderUrl = `${siteUrl}/${shop.slug}/commande/${orderId}`;

    // Best-effort, ne doit jamais faire échouer le changement de statut
    // lui-même — déjà appliqué en base à ce stade.
    sendOrderStatusEmail({
      customerEmail: order.customer_email,
      customerName: order.customer_name,
      shopName: shop.name,
      status,
      orderUrl,
    }).catch(() => {});

    if (order.customer_id) {
      const notification =
        status === "delivered"
          ? {
              title: "Commande livrée — donne ton avis !",
              body: `Ta commande chez ${shop.name} a été marquée comme livrée. Tu peux maintenant laisser un avis sur les produits reçus.`,
              kind: "review_ready",
            }
          : ORDER_STATUS_CUSTOMER_MESSAGE[status] && {
              title: ORDER_STATUS_CUSTOMER_MESSAGE[status]!.title,
              body: `${ORDER_STATUS_CUSTOMER_MESSAGE[status]!.body} (${shop.name})`,
              kind: "status_change",
            };

      if (notification) {
        await supabase.from("notifications").insert({
          profile_id: order.customer_id,
          title: notification.title,
          body: notification.body,
          link: `/${shop.slug}/commande/${orderId}`,
          kind: notification.kind,
        });
      }
    }
  }
}
