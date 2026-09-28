import { sendTransactionalEmail } from "./brevo";

/**
 * Email de confirmation envoyé au vendeur à chaque paiement d'abonnement
 * Nyole confirmé — ajouté le 29/09/2026, à la demande d'Isaac juste après le
 * premier essai à blanc (il s'attendait à une facture par email et n'en a
 * reçu aucune : KEVA n'envoyait jusqu'ici RIEN de son côté à la confirmation
 * d'un paiement, seul `applyPlanToShop` était appelé — voir
 * `api/nyole/webhook/route.ts`). Distinct du reçu que Nyole envoie lui-même
 * de son côté (visible sur sa page de paiement, "Reçu envoyé à") : celui-ci
 * est la confirmation KEVA, sur le même canal gratuit (Brevo) déjà utilisé
 * pour les autres notifications transactionnelles.
 *
 * Appelé UNIQUEMENT depuis le webhook Nyole (`payment.completed`), jamais
 * depuis l'assignation manuelle admin (`admin/abonnements/actions.ts`) : un
 * encaissement manuel hors Nyole n'est pas un "paiement" au sens de cet
 * email — parler de paiement en ligne confirmé alors qu'Isaac a encaissé la
 * main à la main créerait de la confusion chez le vendeur.
 *
 * Best-effort comme tous les emails de ce projet (voir brevo.ts) : un échec
 * d'envoi ne doit jamais remonter jusqu'au webhook et bloquer l'activation
 * réelle du plan, déjà faite avant l'appel à cette fonction.
 */

const dateFR = (iso: string) => new Date(iso).toLocaleDateString("fr-FR");
const amountFR = (amount: number, currency: string) =>
  `${amount.toLocaleString("fr-FR")} ${currency}`;

export async function sendSubscriptionPaymentReceiptEmail({
  to,
  shopName,
  planName,
  amount,
  currency,
  reference,
  expiresAt,
}: {
  to: string;
  shopName: string;
  planName: string;
  amount: number;
  currency: string;
  /** Référence lisible du paiement (order_id Nyole, ex. CS-MF3K2A-9X1QZ). */
  reference: string;
  expiresAt: string;
}): Promise<boolean> {
  const result = await sendTransactionalEmail({
    to,
    subject: `${shopName} — paiement reçu, abonnement ${planName} activé`,
    html: `
      <p>Bonjour,</p>
      <p>
        Ton paiement de <strong>${amountFR(amount, currency)}</strong> pour
        l'abonnement <strong>${planName}</strong> de ${shopName} sur KEVA a
        bien été reçu et confirmé.
      </p>
      <p>
        Ton abonnement est actif jusqu'au
        <strong>${dateFR(expiresAt)}</strong>.
      </p>
      <table style="margin:16px 0;border-collapse:collapse;font-size:14px;">
        <tr>
          <td style="padding:4px 12px 4px 0;color:#888;">Référence</td>
          <td style="padding:4px 0;font-family:monospace;">${reference}</td>
        </tr>
        <tr>
          <td style="padding:4px 12px 4px 0;color:#888;">Montant</td>
          <td style="padding:4px 0;">${amountFR(amount, currency)}</td>
        </tr>
        <tr>
          <td style="padding:4px 12px 4px 0;color:#888;">Plan</td>
          <td style="padding:4px 0;">${planName}</td>
        </tr>
      </table>
      <p>
        Conserve cet email comme justificatif de paiement pour ton
        abonnement KEVA.
      </p>
      <p style="color:#888;font-size:12px;">Boutique : ${shopName}</p>
    `,
  });

  return result.ok;
}
