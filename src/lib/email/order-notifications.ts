import { sendTransactionalEmail } from "./brevo";
import { ORDER_STATUS_CUSTOMER_MESSAGE } from "@/lib/orders";

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
 *
 * `STATUS_MESSAGES` local retiré le 21/09/2026 (espace de notification
 * unifié) au profit de `ORDER_STATUS_CUSTOMER_MESSAGE` (src/lib/orders.ts),
 * désormais partagé avec la notification en base — un seul texte par statut,
 * pas deux à faire évoluer en parallèle. "delivered" reste géré séparément
 * ici (pas dans le module partagé) : c'est le seul statut où le texte email
 * diffère volontairement du texte de la notification en base (email plus
 * détaillé, invite explicitement à revenir sur la page de commande).
 */
const DELIVERED_MESSAGE = {
  subject: "Ta commande a été livrée",
  body: "Ta commande a été marquée comme livrée. N'hésite pas à laisser un avis sur les produits reçus depuis la page de ta commande.",
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

  const shared = ORDER_STATUS_CUSTOMER_MESSAGE[status];
  const message = status === "delivered" ? DELIVERED_MESSAGE : shared && { subject: shared.title, body: shared.body };
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
