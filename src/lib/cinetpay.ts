/**
 * Client CinetPay Checkout v2 — intégration réelle ajoutée le 15/09/2026
 * (compte marchand d'Isaac enfin validé, après plusieurs mois en pause — voir
 * decisions-techniques.md). Référence : https://docs.cinetpay.com/api/1.0-fr/checkout/
 *
 * Ce module manipule la clé API CinetPay (`CINETPAY_API_KEY`) et n'est
 * importé que depuis des Server Actions / Route Handlers (jamais un
 * composant client) — le paquet `server-only` n'est pas une dépendance de ce
 * projet, donc pas de garde-fou automatique à l'import, mais la même
 * discipline que le reste du code (clés secrètes lues uniquement via
 * `process.env` côté serveur) s'applique ici.
 *
 * Variables d'environnement requises (à ajouter sur Vercel ET en local,
 * jamais commitées) :
 * - CINETPAY_API_KEY
 * - CINETPAY_SITE_ID
 */

const CINETPAY_BASE_URL = "https://api-checkout.cinetpay.com/v2";

function getCredentials() {
  const apikey = process.env.CINETPAY_API_KEY;
  const siteId = process.env.CINETPAY_SITE_ID;
  if (!apikey || !siteId) {
    throw new Error(
      "CINETPAY_API_KEY / CINETPAY_SITE_ID manquantes — paiement abonnement indisponible."
    );
  }
  return { apikey, siteId };
}

export type InitiatePaymentParams = {
  transactionId: string;
  /** Multiple de 5 obligatoire côté CinetPay. */
  amount: number;
  description: string;
  notifyUrl: string;
  returnUrl: string;
  /** Passé tel quel à CinetPay, renvoyé dans `cpm_custom` au webhook — jamais utilisé comme source de vérité, seulement pour du contexte de log. */
  metadata?: string;
};

export type InitiatePaymentResult =
  | { ok: true; paymentUrl: string }
  | { ok: false; error: string };

/**
 * Initialise un paiement et renvoie l'URL du guichet CinetPay vers laquelle
 * rediriger le vendeur. N'écrit rien en base — c'est à l'appelant
 * d'enregistrer la tentative dans `payments` AVANT d'appeler cette fonction
 * (recommandation officielle CinetPay : "enregistrer les informations en
 * base de données avant d'afficher le guichet").
 */
export async function initiateCinetPayPayment(
  params: InitiatePaymentParams
): Promise<InitiatePaymentResult> {
  const { apikey, siteId } = getCredentials();

  if (params.amount % 5 !== 0) {
    // Filet de sécurité : CinetPay rejette un montant qui n'est pas un
    // multiple de 5. Nos prix de plans le sont déjà (2500, 7000) mais ça
    // évite une régression silencieuse si un prix change un jour.
    return { ok: false, error: "Le montant doit être un multiple de 5 FCFA." };
  }

  try {
    const response = await fetch(`${CINETPAY_BASE_URL}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey,
        site_id: siteId,
        transaction_id: params.transactionId,
        amount: params.amount,
        currency: "XOF",
        description: params.description,
        notify_url: params.notifyUrl,
        return_url: params.returnUrl,
        channels: "MOBILE_MONEY",
        lang: "fr",
        metadata: params.metadata,
      }),
    });

    const json = await response.json();

    if (json?.code === "201" && json?.data?.payment_url) {
      return { ok: true, paymentUrl: json.data.payment_url as string };
    }

    console.error("CinetPay initiateCinetPayPayment — réponse inattendue:", json);
    return {
      ok: false,
      error: json?.description || json?.message || "Échec de l'initialisation du paiement.",
    };
  } catch (error) {
    console.error("CinetPay initiateCinetPayPayment — erreur réseau:", error);
    return { ok: false, error: "CinetPay est injoignable pour le moment. Réessaie." };
  }
}

export type TransactionCheckResult = {
  /** Statut réellement vérifié auprès de CinetPay — jamais déduit du seul webhook. */
  status: "ACCEPTED" | "REFUSED" | "PENDING" | "UNKNOWN";
  amount: number | null;
  currency: string | null;
  raw: unknown;
};

/**
 * Vérifie le statut réel d'une transaction auprès de CinetPay — étape
 * obligatoire avant de considérer un paiement comme confirmé (leur doc :
 * "Always perform a call to the transaction verification API to obtain true
 * payment values"). Le webhook ne doit JAMAIS activer un abonnement sur la
 * seule foi du payload qu'il reçoit.
 */
export async function checkCinetPayTransactionStatus(
  transactionId: string
): Promise<TransactionCheckResult> {
  const { apikey, siteId } = getCredentials();

  try {
    const response = await fetch(`${CINETPAY_BASE_URL}/payment/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apikey, site_id: siteId, transaction_id: transactionId }),
    });

    const json = await response.json();
    const rawStatus = String(json?.data?.status ?? json?.status ?? "").toUpperCase();

    const status: TransactionCheckResult["status"] =
      rawStatus === "ACCEPTED" || json?.code === "00"
        ? "ACCEPTED"
        : rawStatus === "REFUSED" || json?.code === "627"
          ? "REFUSED"
          : rawStatus === "PENDING" || rawStatus === "WAITING_FOR_CUSTOMER"
            ? "PENDING"
            : "UNKNOWN";

    return {
      status,
      amount: typeof json?.data?.amount === "number" ? json.data.amount : null,
      currency: json?.data?.currency ?? null,
      raw: json,
    };
  } catch (error) {
    console.error("CinetPay checkCinetPayTransactionStatus — erreur réseau:", error);
    return { status: "UNKNOWN", amount: null, currency: null, raw: null };
  }
}
