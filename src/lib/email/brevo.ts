/**
 * Envoi d'emails transactionnels (hors emails d'authentification Supabase,
 * déjà gérés par le SMTP Brevo configuré dans le dashboard Supabase — voir
 * decisions-techniques.md, section SMTP externe) via l'API HTTP Brevo.
 *
 * Créé le 14/09/2026 pour les notifications de changement de statut de
 * commande : c'est le seul canal réellement automatique ET gratuit
 * disponible pour joindre un client sans compte (le SMS coûte de l'argent,
 * l'API WhatsApp Business n'est pas branchée — voir "Notifications client"
 * dans decisions-techniques.md).
 *
 * Volontairement l'API HTTP de Brevo (`POST /v3/smtp/email`, clé `api-key`)
 * plutôt que le relais SMTP + une lib comme nodemailer : pas de nouvelle
 * dépendance npm, un simple `fetch`, et le même compte Brevo gratuit
 * (300 emails/jour) déjà utilisé pour les emails Supabase Auth — mais une
 * clé DIFFÉRENTE est nécessaire (Brevo distingue "clés SMTP" et "clés API"
 * dans Réglages > SMTP & API). Isaac doit générer une clé API Brevo et la
 * renseigner dans `BREVO_API_KEY` (.env.local + Vercel), et choisir un
 * expéditeur sur un domaine déjà authentifié (`BREVO_SENDER_EMAIL`,
 * ex: commandes@agnissanisaac.com — n'importe quelle adresse sur
 * agnissanisaac.com fonctionne, le domaine entier est authentifié SPF/DKIM).
 *
 * Best-effort partout où c'est appelé : un email de notification qui échoue
 * ne doit jamais bloquer l'action réelle (changement de statut). Pas
 * d'exception levée ici, seulement un résultat {ok, error?} et un
 * console.error pour le débogage.
 */

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

export async function sendTransactionalEmail({
  to,
  toName,
  subject,
  html,
  replyTo,
}: {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  // Ajouté le 22/09/2026 pour le formulaire "Nous contacter" (voir
  // contact-message.ts) : permet à Isaac de répondre directement au client
  // depuis son client mail habituel, sans que l'email arrive comme venant
  // de lui-même (l'expéditeur reste toujours BREVO_SENDER_EMAIL).
  replyTo?: { email: string; name?: string };
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;

  if (!apiKey || !senderEmail) {
    // Pas configuré (dev local sans clé, ou avant qu'Isaac ne l'ajoute en
    // prod) : on n'envoie rien, mais on ne fait jamais échouer l'appelant.
    console.error(
      "sendTransactionalEmail: BREVO_API_KEY ou BREVO_SENDER_EMAIL manquant, email non envoyé."
    );
    return { ok: false, error: "not_configured" };
  }

  try {
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: "Boutique en ligne" },
        to: [{ email: to, name: toName }],
        subject,
        htmlContent: html,
        ...(replyTo ? { replyTo } : {}),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`sendTransactionalEmail: échec Brevo (${response.status}) ${body}`);
      return { ok: false, error: `brevo_${response.status}` };
    }

    return { ok: true };
  } catch (err) {
    console.error("sendTransactionalEmail: erreur réseau", err);
    return { ok: false, error: "network" };
  }
}
