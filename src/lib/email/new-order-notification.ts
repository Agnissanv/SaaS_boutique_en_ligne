import { sendTransactionalEmail } from "./brevo";

/**
 * Email au VENDEUR quand une nouvelle commande arrive — ajouté le 15/09/2026,
 * identifié comme "essentiel pour concurrencer" par Isaac : jusqu'ici le
 * seul moyen de savoir qu'une commande venait d'arriver était de retourner
 * consulter le dashboard soi-même, aucune alerte proactive n'existait alors
 * que c'est un signal business important (contrairement à
 * order-notifications.ts, qui notifie le CLIENT d'un changement de statut).
 *
 * Même pattern best-effort/silencieux que le reste des emails du projet.
 */
export async function sendNewOrderVendorEmail({
  notificationEmail,
  shopName,
  customerName,
  totalAmount,
  orderUrl,
}: {
  notificationEmail: string | null | undefined;
  shopName: string;
  customerName: string;
  totalAmount: number;
  orderUrl: string;
}): Promise<void> {
  if (!notificationEmail) return;

  await sendTransactionalEmail({
    to: notificationEmail,
    subject: `${shopName} — Nouvelle commande reçue`,
    html: `
      <p>Bonjour,</p>
      <p>Tu as reçu une nouvelle commande de <strong>${customerName}</strong> pour un montant de <strong>${totalAmount} FCFA</strong>.</p>
      <p><a href="${orderUrl}">Voir la commande</a></p>
      <p style="color:#888;font-size:12px;">Boutique : ${shopName}</p>
    `,
  });
}
