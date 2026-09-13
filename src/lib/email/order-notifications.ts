import { sendTransactionalEmail } from "./brevo";

/**
 * Email automatique au client quand le vendeur change le statut de sa
 * commande — voir "Notifications client automatiques" dans
 * decisions-techniques.md pour le choix (email optionnel + bouton WhatsApp
 * en complément, plutôt qu'un vrai canal automatique inexistant pour
 * l'instant côté SMS/WhatsApp Business API).
 *
 * Best-effort et silencieux : appelé depuis une Server Action après la vraie
 * mise à jour en base, ne doit jamais faire échouer l'action elle-même si
 * l'email ne part pas (client sans email, Brevo indisponible, etc.).
 */

const STATUS_MESSAGES: Partial<Record<string, { subject: string; body: string }>> = {
  paid: {
    subject: "Ta commande a été confirmée",
    body: "Bonne nouvelle : ta commande a été confirmée par le vendeur.",
  },
  preparing: {
    subject: "Ta commande est en préparation",
    body: "Le vendeur a commencé à préparer ta commande.",
  },
  delivered: {
    subject: "Ta commande a été livrée",
    body: "Ta commande a été marquée comme livrée. N'hésite pas à laisser un avis sur les produits reçus depuis la page de ta commande.",
  },
  cancelled: {
    subject: "Ta commande a été annulée",
    body: "Ta commande a été annulée par le vendeur. Contacte-le directement si tu as des questions.",
  },
};

export async function sendOrderStatusEmail({
  customerEmail,
  customerName,
  shopName,
  status,
  orderUrl,
}: {
  customerEmail: string | null | undefined;
  customerName: string;
  shopName: string;
  status: string;
  orderUrl: string;
}): Promise<void> {
  if (!customerEmail) return;

  const message = STATUS_MESSAGES[status];
  if (!message) return; // "pending" (état initial) ou statut inconnu : rien à notifier.

  await sendTransactionalEmail({
    to: customerEmail,
    toName: customerName,
    subject: `${shopName} — ${message.subject}`,
    html: `
      <p>Bonjour ${customerName},</p>
      <p>${message.body}</p>
      <p><a href="${orderUrl}">Voir le détail de ta commande</a></p>
      <p style="color:#888;font-size:12px;">Boutique : ${shopName}</p>
    `,
  });
}
