import { sendTransactionalEmail } from "./brevo";

/**
 * Email au support KEVA depuis le formulaire "Nous contacter" (créé le
 * 22/09/2026, remplace le lien mailto:contactkevashop@gmail.com utilisé
 * jusque-là) — voir decisions-techniques.md, "Nettoyage UX/UI". Isaac a
 * choisi cette option plutôt qu'un mailto direct pour ne pas faire sortir le
 * client de l'app (surtout une fois installée en PWA), et plutôt qu'un vrai
 * système de tickets admin, jugé prématuré tant que le volume de messages ne
 * le justifie pas (même logique que le "Support basique" en note libre côté
 * admin, decisions-techniques.md).
 *
 * `SUPPORT_EMAIL` en dur plutôt qu'une variable d'environnement : c'est une
 * adresse de contact du produit (comme dans les pages légales), pas un
 * secret ni une adresse d'expédition technique (`BREVO_SENDER_EMAIL` reste,
 * lui, en variable d'environnement). À corriger ici en même temps que dans
 * les pages légales si Isaac passe un jour à une adresse dédiée
 * (contact@shopkeva.com).
 *
 * `replyTo` pointé vers l'adresse du client : Isaac peut répondre directement
 * depuis sa boîte mail, comme s'il répondait à un email reçu normalement.
 */
const SUPPORT_EMAIL = "contactkevashop@gmail.com";

export async function sendContactMessageEmail({
  name,
  email,
  subject,
  message,
}: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<{ ok: boolean; error?: string }> {
  const escapedMessage = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br />");

  return sendTransactionalEmail({
    to: SUPPORT_EMAIL,
    subject: `[Nous contacter] ${subject} — ${name}`,
    replyTo: { email, name },
    html: `
      <p><strong>Nom :</strong> ${name}</p>
      <p><strong>Email :</strong> ${email}</p>
      <p><strong>Sujet :</strong> ${subject}</p>
      <hr />
      <p>${escapedMessage}</p>
    `,
  });
}
