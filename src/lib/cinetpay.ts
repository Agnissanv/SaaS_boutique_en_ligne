/**
 * Client CinetPay — API "1.0 Aurora", réécrit le 15/09/2026.
 *
 * Contexte : la première version de ce fichier avait été écrite à partir de
 * la documentation générale trouvée en ligne (Checkout v2 : `apikey` +
 * `site_id`, base `api-checkout.cinetpay.com/v2`). En configurant son compte
 * avec Isaac, on a découvert que son tableau de bord CinetPay documente une
 * version différente et plus récente de l'API ("1.0 Aurora", base
 * `api.cinetpay.com`) — contrat entièrement relu directement depuis cette
 * documentation intégrée à son compte, page par page, avant de réécrire ce
 * fichier. Voir decisions-techniques.md pour le détail de la découverte.
 *
 * Authentification en DEUX temps (différence majeure avec la v2 Checkout) :
 * 1. `POST /v1/oauth/login` avec `{ api_key, api_password }` renvoie un
 *    `access_token` de type bearer, valable `expires_in` secondes (~1h36 vu
 *    en sandbox). Les codes d'erreur documentés 1002 (INVALID_TOKEN) et 1003
 *    (EXPIRED_TOKEN) confirment que ce jeton doit être renvoyé sur les appels
 *    suivants via l'en-tête `Authorization: Bearer <token>` — ce n'est pas
 *    explicitement montré dans les exemples de requête (qui ne montrent que
 *    le corps JSON), mais c'est la seule lecture cohérente avec l'existence
 *    de ces codes d'erreur pour un jeton absent/expiré/invalide.
 * 2. `POST /v1/payment` pour initier un paiement, `GET
 *    /v1/payment/{merchant_transaction_id}` pour vérifier son statut réel —
 *    jamais sur la seule foi du webhook (voir /api/cinetpay/webhook/route.ts).
 *
 * Statuts confirmés via la page "Codes de statut" du compte (colonne "Statut
 * final") : `SUCCESS` (100, final, succès) ; `FAILED` / `INSUFFICIENT_BALANCE`
 * / `TRANSACTION_EXIST` (2010 / 2005 / 1200, final, échec ou déjà traité) ;
 * `PENDING` / `INITIATED` / `EXPIRED` (non final — on ne fait rien, le statut
 * définitif arrivera plus tard).
 *
 * Variables d'environnement requises (Vercel + .env.local, jamais commitées) :
 * - CINETPAY_API_KEY
 * - CINETPAY_API_PASSWORD
 * (CINETPAY_SITE_ID n'existe plus dans cette version de l'API — ce concept de
 * "site" n'apparaît nulle part dans la doc Aurora : à retirer de Vercel une
 * fois la bascule confirmée par un vrai test.)
 */

const CINETPAY_BASE_URL = "https://api.cinetpay.com";

function getCredentials() {
  const apiKey = process.env.CINETPAY_API_KEY;
  const apiPassword = process.env.CINETPAY_API_PASSWORD;
  if (!apiKey || !apiPassword) {
    throw new Error(
      "CINETPAY_API_KEY / CINETPAY_API_PASSWORD manquantes — paiement abonnement indisponible."
    );
  }
  return { apiKey, apiPassword };
}

/**
 * Cache mémoire du jeton — best-effort seulement (propre à l'instance serveur
 * en cours, perdu à chaque cold start Vercel). Ce n'est qu'une optimisation
 * pour éviter un aller-retour `/oauth/login` supplémentaire sur une instance
 * déjà "chaude" ; jamais une source de vérité, jamais partagé entre requêtes
 * concurrentes de façon garantie.
 */
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) {
    return cachedToken.value;
  }

  const { apiKey, apiPassword } = getCredentials();

  const response = await fetch(`${CINETPAY_BASE_URL}/v1/oauth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, api_password: apiPassword }),
  });

  const json = await response.json();

  if (json?.code !== 200 || typeof json?.access_token !== "string") {
    console.error("CinetPay getAccessToken — échec de connexion:", json);
    throw new Error("Impossible de s'authentifier auprès de CinetPay.");
  }

  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + Number(json.expires_in ?? 0) * 1000,
  };

  return cachedToken.value;
}

export type InitiatePaymentParams = {
  transactionId: string;
  amount: number;
  description: string;
  notifyUrl: string;
  successUrl: string;
  failedUrl: string;
  clientEmail: string;
  clientFirstName: string;
  clientLastName: string;
};

export type InitiatePaymentResult =
  | { ok: true; paymentUrl: string; notifyToken: string | null }
  | { ok: false; error: string };

/**
 * Initialise un paiement et renvoie l'URL du guichet CinetPay vers laquelle
 * rediriger le vendeur. N'écrit rien en base — c'est à l'appelant
 * d'enregistrer la tentative dans `payments` AVANT d'appeler cette fonction
 * (recommandation officielle CinetPay : enregistrer en base avant d'afficher
 * le guichet).
 */
export async function initiateCinetPayPayment(
  params: InitiatePaymentParams
): Promise<InitiatePaymentResult> {
  try {
    const token = await getAccessToken();

    const response = await fetch(`${CINETPAY_BASE_URL}/v1/payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        currency: "XOF",
        merchant_transaction_id: params.transactionId,
        amount: params.amount,
        lang: "fr",
        designation: params.description,
        client_email: params.clientEmail,
        client_first_name: params.clientFirstName,
        client_last_name: params.clientLastName,
        success_url: params.successUrl,
        failed_url: params.failedUrl,
        notify_url: params.notifyUrl,
      }),
    });

    const json = await response.json();

    if (json?.code === 200 && json?.status === "OK" && typeof json?.payment_url === "string") {
      return {
        ok: true,
        paymentUrl: json.payment_url,
        // Stocké en base par l'appelant et comparé au `notify_token` reçu
        // par le webhook — recommandation officielle CinetPay ("Notification
        // de transaction") pour authentifier une notification avant même de
        // consulter l'API de vérification.
        notifyToken: typeof json?.notify_token === "string" ? json.notify_token : null,
      };
    }

    console.error("CinetPay initiateCinetPayPayment — réponse inattendue:", json);
    return {
      ok: false,
      error: json?.description || json?.details?.message || "Échec de l'initialisation du paiement.",
    };
  } catch (error) {
    console.error("CinetPay initiateCinetPayPayment — erreur:", error);
    return { ok: false, error: "CinetPay est injoignable pour le moment. Réessaie." };
  }
}

export type TransactionCheckResult = {
  /** Statut réellement vérifié auprès de CinetPay — jamais déduit du seul webhook. */
  status: "ACCEPTED" | "REFUSED" | "PENDING" | "UNKNOWN";
  raw: unknown;
};

/**
 * Statuts de la page "Codes de statut" du compte dont la colonne "Statut
 * final" vaut "Oui" et qui ne veulent PAS dire succès. `TRANSACTION_EXIST`
 * n'apparaît normalement que sur l'initialisation (pas sur ce endpoint de
 * vérification), mais on le traite en échec ici aussi par prudence : si on le
 * voit un jour sur `/v1/payment/{id}`, ça ne peut pas vouloir dire "paiement
 * accepté".
 */
const FINAL_FAILURE_STATUSES = new Set([
  "FAILED",
  "INSUFFICIENT_BALANCE",
  "USER_NOT_FOUND",
  "USER_IS_BLOCKED",
  "NOT_ALLOWED",
  "OTP_ERROR",
  "OTP_EXPIRED",
  "EXPIRED",
  "TRANSACTION_EXIST",
]);

/**
 * Vérifie le statut réel d'une transaction auprès de CinetPay — étape
 * obligatoire avant de considérer un paiement comme confirmé. Le webhook ne
 * doit JAMAIS activer un abonnement sur la seule foi du payload qu'il reçoit.
 */
export async function checkCinetPayTransactionStatus(
  transactionId: string
): Promise<TransactionCheckResult> {
  try {
    const token = await getAccessToken();

    const response = await fetch(
      `${CINETPAY_BASE_URL}/v1/payment/${encodeURIComponent(transactionId)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const json = await response.json();
    const rawStatus = String(json?.status ?? "").toUpperCase();

    const status: TransactionCheckResult["status"] =
      rawStatus === "SUCCESS"
        ? "ACCEPTED"
        : FINAL_FAILURE_STATUSES.has(rawStatus)
          ? "REFUSED"
          : rawStatus === "PENDING" || rawStatus === "INITIATED"
            ? "PENDING"
            : "UNKNOWN";

    return { status, raw: json };
  } catch (error) {
    console.error("CinetPay checkCinetPayTransactionStatus — erreur:", error);
    return { status: "UNKNOWN", raw: null };
  }
}
