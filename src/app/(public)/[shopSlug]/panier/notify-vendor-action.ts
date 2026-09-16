"use server";

import { createClient } from "@/lib/supabase/server";
import { sendNewOrderVendorEmail } from "@/lib/email/new-order-notification";
import { sendLowStockVendorEmail } from "@/lib/email/low-stock-alert";

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

    // `has_order_notifications` calculé côté base par `get_order_notification_info`
    // (le plan actuel de la boutique, cf. migration 0020) — Starter n'a plus
    // droit à cet email depuis le 16/09/2026, Business/Pro oui. Décision
    // produit d'Isaac, ce n'était auparavant vérifié nulle part.
    if (!info?.notification_email || !info.has_order_notifications) return;

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

/**
 * Prévient le vendeur par email si cette commande vient de faire passer un
 * ou plusieurs produits sous leur seuil d'alerte — "alertes de stock
 * avancées" (`has_advanced_stock_alerts`, plan Pro, ajouté le 16/09/2026).
 * Appelée en parallèle de `notifyVendorNewOrder` (voir cart-checkout.tsx),
 * dans une action séparée plutôt que fusionnée : deux préoccupations
 * distinctes (nouvelle commande vs stock bas), chacune avec son propre flag
 * de plan, sa propre requête et son propre email — plus simple à faire
 * évoluer indépendamment.
 *
 * `get_low_stock_alert_info` (migration 0021) fait tout le travail côté
 * base : plan de la boutique, franchissement de seuil, tout est vérifié
 * là-bas — ne renvoie des lignes QUE quand un email doit vraiment partir.
 */
export async function notifyVendorLowStock(orderId: string): Promise<void> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_low_stock_alert_info", {
      p_order_id: orderId,
    });
    const rows = data ?? [];

    if (rows.length === 0) return;

    await sendLowStockVendorEmail({
      notificationEmail: rows[0].notification_email,
      shopName: rows[0].shop_name,
      products: rows.map((r: { product_title: string; stock_after: number; threshold: number }) => ({
        title: r.product_title,
        stock: r.stock_after,
        threshold: r.threshold,
      })),
    });
  } catch {
    // Best-effort : jamais bloquant pour l'expérience client.
  }
}
