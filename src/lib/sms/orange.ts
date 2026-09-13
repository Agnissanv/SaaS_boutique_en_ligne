/**
 * Envoi de SMS via l'API Orange SMS Côte d'Ivoire.
 * ~7 FCFA/SMS (bundles prépayés), vers tous les opérateurs (Orange, MTN, Moov) —
 * remplace Twilio (~0,49 $ soit ~290 FCFA/SMS vers la CI, inutilisable pour un
 * abonnement à 3 000 FCFA/mois). Voir decisions-techniques.md.
 *
 * Doc officielle : https://developer.orange.com/apis/sms-ci
 *
 * TODO avant mise en prod : vérifier le format exact de senderAddress attendu
 * (numéro/short code assigné par Orange dans "My apps") et le comportement en
 * sandbox vs prod — non testable depuis cet environnement sans compte réel.
 */

const TOKEN_URL = "https://api.orange.com/oauth/v3/token";
const SMS_BASE_URL = "https://api.orange.com/smsmessaging/v1";

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  const clientId = process.env.ORANGE_SMS_CLIENT_ID!;
  const clientSecret = process.env.ORANGE_SMS_CLIENT_SECRET!;
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error(`Échec récupération token Orange : ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  // expires_in en secondes (généralement 3600). Marge de sécurité de 60s.
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in ?? 3600) - 60) * 1000,
  };
  return cachedToken.value;
}

/**
 * Envoie un SMS via l'API Orange Côte d'Ivoire.
 * @param phoneE164 Numéro destinataire au format international, ex: "+2250700000000"
 * @param message Contenu du SMS
 */
export async function sendSmsViaOrange(phoneE164: string, message: string) {
  const senderNumber = process.env.ORANGE_SMS_SENDER_NUMBER!; // ex: "2250000" (assigné par Orange)
  const token = await getAccessToken();

  const recipient = phoneE164.replace(/^\+/, "");

  const response = await fetch(
    `${SMS_BASE_URL}/outbound/tel%3A%2B${senderNumber}/requests`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        outboundSMSMessageRequest: {
          address: `tel:+${recipient}`,
          senderAddress: `tel:+${senderNumber}`,
          outboundSMSTextMessage: { message },
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Échec envoi SMS Orange : ${response.status} ${await response.text()}`);
  }
}
