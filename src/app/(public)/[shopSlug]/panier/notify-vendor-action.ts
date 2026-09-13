"use server";

import { createClient } from "@/lib/supabase/server";
import { sendNewOrderVendorEmail } from "@/lib/email/new-order-notification";

/**
 * Notifie le vendeur par email qu'une nouvelle commande vient d'arriver —
 * appelée côté client juste après un `create_order` réussi (voir
 * cart-checkout.tsx). Server Action plutôt qu'un appel RPC + fetch Brevo
 * directement dans le composant client : la clé API Brevo ne doit jamais
 * être exposée au navigateur.
 *
 * Best-effort et silencieuse, comme tous les envois Brevo du projet : la
 * commande est déjà créée à ce stade, aucune erreur ici ne doit jamais
 * remonter au client comme un échec de commande.
 */
export async function notifyVendorNewOrder(orderId: string): Promise<void> {
  try {
    const supabase = await createClient();
    // Pas de `.maybeSingle()` : même convention que get_order_receipt
    // ailleurs dans le projet (RETURNS TABLE -> tableau, on prend [0]) — plus
    // fiable pour l'inférence de type ici que `Database = any` (placeholder,
    // voir src/lib/types/database.ts) ne le permet avec `.maybeSingle()`.
    const { data } = await supabase.rpc("get_order_notification_info", {
      p_order_id: orderId,
    });
    const info = data?.[0];

    if (!info?.notification_email) return;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    await sendNewOrderVendorEmail({
      notificationEmail: info.notification_email,
      shopName: info.shop_name,
      customerName: info.customer_name,
      totalAmount: info.total_amount,
      orderUrl: `${siteUrl}${info.order_url_path}`,
    });
  } catch {
    // Best-effort : jamais bloquant pour l'expérience client.
  }
}
