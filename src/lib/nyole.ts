/**
 * Client Nyole — agrégateur de paiement Mobile Money/carte, remplace
 * CinetPay en totalité le 28/09/2026 à la demande explicite d'Isaac : "on
 * laisse tous les autres agrégateurs de paiement. On va utiliser celui-là."
 * Isaac avait déjà un compte Nyole créé et vérifié (documents KYC soumis)
 * au moment de cette bascule.
 *
 * Contrat relu intégralement depuis la documentation publique de Nyole
 * (https://nyole.com/docs/, pages Introduction, Démarrage rapide,
 * Authentification, Mode test, Créer une session, Vérifier le statut,
 * Configuration webhook, Événements, Vérifier la signature, Codes
 * d'erreur, Limites de taux — toutes lues via navigateur le 28/09/2026,
 * `WebFetch` ayant été bloqué par le robots.txt de nyole.com) avant d'écrire
 * une seule ligne ici — même discipline que pour CinetPay en son temps (voir
 * l'ancien src/lib/cinetpay.ts dans l'historique git : sa première version
 * avait dû être entièrement réécrite pour avoir été construite sur une
 * documentation générique plutôt que le contrat réel du compte).
 *
 * Différences structurelles avec CinetPay, qui ont guidé ce fichier :
 * - Authentification en un seul en-tête (`Authorization: Bearer
 *   af_live_sec_...`), pas de `/oauth/login` séparé ni de jeton à mettre en
 *   cache — la clé secrète EST le jeton.
 * - Nyole attribue lui-même l'identifiant de session (`id`, ex.
 *   `cmf3k2p1x...`) à la création — on ne fournit jamais nous-mêmes de
 *   `merchant_transaction_id` côté Nyole (contrairement à CinetPay). C'est
 *   cet `id` renvoyé par la création qu'on stocke comme
 *   `provider_transaction_id` en base, et c'est ce même `id` qui revient dans
 *   `data.id` du webhook — la correspondance se fait donc naturellement,
 *   sans jeton d'authenticité séparé à comparer (CinetPay avait
 *   `notify_token` pour ça faute de webhook signé).
 * - Webhook SIGNÉ (HMAC-SHA256, en-têtes `X-Afriflow-Timestamp` +
 *   `X-Afriflow-Signature`) — différence de sécurité majeure avec CinetPay,
 *   dont le webhook n'était pas signé du tout ("Ne faites JAMAIS confiance
 *   au statut transmis dans le webhook", doc CinetPay). Une fois la
 *   signature vérifiée, la documentation Nyole elle-même traite le webhook
 *   comme faisant foi ("Seuls ce statut et le webhook font foi", page
 *   Vérifier le statut) — donc pas besoin de revérifier systématiquement le
 *   statut par un second appel GET avant de créditer, contrairement à
 *   CinetPay où c'était une étape obligatoire. `getNyoleSessionStatus`
 *   reste disponible pour rattraper un webhook manqué (retour client sur
 *   `success_url`, vérif manuelle) mais n'est plus une étape imposée du
 *   webhook lui-même.
 * - Pas de liste blanche d'IP à demander : Nyole ne mentionne cette
 *   contrainte nulle part dans sa documentation — le relais IP fixe qu'il
 *   avait fallu construire pour CinetPay (VM à IP fixe, voir l'historique
 *   git de cinetpay.ts) n'a plus lieu d'être. Un appel direct depuis Vercel
 *   suffit.
 *
 * Base URL unique (`https://app.nyole.com/api`), pas d'environnement
 * sandbox séparé : ce sont les clés qui font le monde d'un paiement
 * (`af_live_sec_...` vs `af_test_sec_...`, voir doc "Mode test"). Ce fichier
 * n'utilise que la clé live — le mode test n'est pas câblé ici faute de
 * besoin actuel, mais rien n'empêche de l'ajouter plus tard (même API,
 * même route, juste une autre valeur de `NYOLE_SECRET_KEY`).
 *
 * Variable d'environnement requise (Vercel + .env.local, jamais commitée) :
 * - NYOLE_SECRET_KEY (af_live_sec_..., trouvable dans l'espace Nyole
 *   d'Isaac sous "API et journaux")
 */

const NYOLE_BASE_URL = "https://app.nyole.com/api";

/**
 * Nom + logo forcés sur CHAQUE session (29/09/2026, demande d'Isaac après le
 * premier essai à blanc : la page de paiement affichait "keva" et un logo
 * minuscule tirés des réglages de son compte Nyole, pas du vrai logo KEVA).
 * D'après la doc ("Créer une session de paiement") : `merchant_name` et
 * `merchant_logo` sont les DEUX SEULS leviers de personnalisation exposés par
 * la page hébergée Nyole — pas de couleurs, pas de police, pas de mise en
 * page. `merchant_logo` exige une adresse https publique (PNG/JPG/SVG) :
 * `keva-logo.jpg` (800x800, public/keva-logo.jpg) est déjà servi tel quel
 * par Next depuis `/public`, donc accessible en direct sur le domaine de
 * prod — pas besoin de l'héberger ailleurs.
 */
const NYOLE_MERCHANT_NAME = "KEVA";
const NYOLE_MERCHANT_LOGO_URL = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://shopkeva.com"}/keva-logo.jpg`;

/**
 * Coupe-circuit optionnel — même principe que `isCinetPayEnabled()` en son
 * temps, gardé par prudence opérationnelle (permet de masquer proprement le
 * paiement en ligne depuis Vercel sans déploiement si un incident survient
 * côté Nyole), mais Isaac a confirmé son compte Nyole prêt à encaisser :
 * `true` par défaut, contrairement à l'ancien coupe-circuit CinetPay qui
 * démarrait à `false` en attendant une validation de compte qui n'avait pas
 * encore eu lieu.
 */
export function isNyolePaymentsEnabled(): boolean {
  return process.env.NYOLE_PAYMENTS_ENABLED !== "false";
}

/**
 * Fait porter la commission Nyole (5% par défaut — voir doc "Commission et
 * frais") par le PAYEUR plutôt que par le bénéficiaire — ajouté le 29/09/2026
 * à la demande explicite d'Isaac pour les abonnements ("Est-ce qu'il y a
 * possibilité de faire en sorte que les frais soient enlevés chez le
 * client ? [...] Si il y a possibilité, fais-le"), puis étendu par cohérence
 * aux paiements de commande en ligne (même logique : "100% pour le vendeur,
 * on ne touche pas à sa commission" — un vendeur qui garde 100% de sa marge
 * affichée doit recevoir le montant plein, pas montant-moins-5%).
 *
 * D'après la doc Nyole elle-même : "Le réglage ne déplace que les frais de
 * passerelle, jamais la commission" — la commission Nyole n'est PAS un
 * paramètre API ni un réglage transférable, contrairement aux frais de
 * passerelle (réseau/opérateur, eux configurables côté tableau de bord Nyole
 * pour être à la charge du client — mais uniquement depuis l'espace Nyole
 * d'Isaac, jamais via cette API). La seule façon d'obtenir le même résultat
 * ("le bénéficiaire touche le plein montant") est donc de majorer ici le
 * montant réellement facturé au payeur, pour qu'une fois la commission
 * Nyole déduite, il reste exactement (environ) le montant net voulu :
 *
 *   montant_facturé = montant_net / (1 - taux)
 *
 * `Math.ceil` plutôt que `Math.round` : en cas d'arrondi, mieux vaut que le
 * bénéficiaire touche quelques francs CFA de PLUS que promis, jamais moins.
 *
 * Le taux vient d'une variable d'environnement (`NYOLE_COMMISSION_RATE`,
 * défaut 5%) plutôt que d'être codé en dur : c'est un réglage du compte
 * Nyole d'Isaac ("Il est de 5% par défaut", donc modifiable), pas une
 * constante de cette API — un changement de taux côté Nyole ne doit pas
 * nécessiter un déploiement de code pour rester exact.
 *
 * Si le taux configuré est invalide (absent, hors de ]0;1[), on renvoie le
 * montant net tel quel plutôt que de planter ou de diviser par zéro —
 * dégrade proprement vers "pas de majoration" plutôt que de bloquer un
 * paiement.
 */
export function grossUpAmountForNyoleCommission(netAmount: number): number {
  const rate = Number(process.env.NYOLE_COMMISSION_RATE ?? "0.05");
  if (!Number.isFinite(rate) || rate <= 0 || rate >= 1) return netAmount;
  return Math.ceil(netAmount / (1 - rate));
}

function getSecretKey(): string {
  const key = process.env.NYOLE_SECRET_KEY;
  if (!key) {
    throw new Error("NYOLE_SECRET_KEY manquante — paiement abonnement indisponible.");
  }
  return key;
}

export type CreateCheckoutSessionParams = {
  amount: number;
  description: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  metadata?: Record<string, string>;
  /** Sert de clé `Idempotency-Key` — rejoue le même appel sans créer deux sessions en cas de retry réseau. */
  idempotencyKey: string;
};

export type CreateCheckoutSessionResult =
  | { ok: true; id: string; url: string; orderId: string }
  | { ok: false; error: string };

/**
 * Crée une session de paiement Nyole et renvoie l'URL de la page de paiement
 * hébergée vers laquelle rediriger le vendeur. N'écrit rien en base —
 * l'appelant enregistre la tentative dans `payments` avant d'appeler cette
 * fonction, puis y ajoute l'`id` renvoyé ici une fois connu (voir
 * `dashboard/abonnement/actions.ts`).
 */
export async function createNyoleCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<CreateCheckoutSessionResult> {
  try {
    const response = await fetch(`${NYOLE_BASE_URL}/v1/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getSecretKey()}`,
        "Content-Type": "application/json",
        "Idempotency-Key": params.idempotencyKey,
      },
      body: JSON.stringify({
        amount: params.amount,
        currency: "XOF",
        customer_name: params.customerName,
        customer_email: params.customerEmail,
        customer_phone: params.customerPhone,
        description: params.description,
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        metadata: params.metadata,
        merchant_name: NYOLE_MERCHANT_NAME,
        merchant_logo: NYOLE_MERCHANT_LOGO_URL,
      }),
    });

    const json = await response.json();

    if (response.status === 201 && typeof json?.url === "string" && typeof json?.id === "string") {
      return { ok: true, id: json.id, url: json.url, orderId: json.order_id ?? "" };
    }

    console.error("Nyole createNyoleCheckoutSession — réponse inattendue:", json);
    return { ok: false, error: json?.error || "Échec de l'initialisation du paiement." };
  } catch (error) {
    console.error("Nyole createNyoleCheckoutSession — erreur:", error);
    return { ok: false, error: "Nyole est injoignable pour le moment. Réessaie." };
  }
}

export type NyoleSessionStatus = "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED" | "REFUNDED" | "UNKNOWN";

export type SessionStatusResult = {
  status: NyoleSessionStatus;
  paid: boolean;
  raw: unknown;
};

const KNOWN_STATUSES = new Set<NyoleSessionStatus>([
  "PENDING",
  "SUCCESS",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
]);

/**
 * Interroge le statut réel d'une session — utile pour rattraper un webhook
 * manqué (retour client sur `success_url`, vérification manuelle admin).
 * Pas appelée systématiquement par le webhook lui-même : voir le
 * raisonnement en tête de fichier (webhook signé Nyole = fait foi une fois
 * la signature vérifiée).
 */
export async function getNyoleSessionStatus(sessionId: string): Promise<SessionStatusResult> {
  try {
    const response = await fetch(
      `${NYOLE_BASE_URL}/v1/checkout/sessions/${encodeURIComponent(sessionId)}/status`,
      { headers: { Authorization: `Bearer ${getSecretKey()}` } }
    );

    const json = await response.json();
    const rawStatus = String(json?.status ?? "").toUpperCase();
    const status = KNOWN_STATUSES.has(rawStatus as NyoleSessionStatus)
      ? (rawStatus as NyoleSessionStatus)
      : "UNKNOWN";

    return { status, paid: json?.paid === true, raw: json };
  } catch (error) {
    console.error("Nyole getNyoleSessionStatus — erreur:", error);
    return { status: "UNKNOWN", paid: false, raw: null };
  }
}

/**
 * Vérifie la signature d'un webhook Nyole — algorithme documenté sur la
 * page "Vérifier la signature" : `HMAC-SHA256(<horodatage>.<corps brut>)`
 * avec la clé secrète, comparé en temps constant à `v1=` dans l'en-tête
 * `X-Afriflow-Signature`, et un horodatage refusé au-delà de 5 minutes
 * (protection anti-rejeu). `rawBody` DOIT être le corps de la requête tel
 * que reçu, jamais un JSON reparsé puis re-sérialisé — voir l'appelant
 * (`api/nyole/webhook/route.ts`), qui lit `request.text()` avant tout
 * `JSON.parse`.
 */
export async function verifyNyoleWebhookSignature(params: {
  rawBody: string;
  timestampHeader: string | null;
  signatureHeader: string | null;
  secret: string;
}): Promise<boolean> {
  const { rawBody, timestampHeader, signatureHeader, secret } = params;
  if (!timestampHeader || !signatureHeader) return false;

  const signature = signatureHeader
    .split(",")
    .find((part) => part.startsWith("v1="))
    ?.slice(3);
  if (!signature) return false;

  const timestampSeconds = Number(timestampHeader);
  if (!Number.isFinite(timestampSeconds)) return false;
  if (Math.abs(Date.now() / 1000 - timestampSeconds) > 300) return false;

  // `node:crypto` plutôt que Web Crypto : ce fichier tourne uniquement dans
  // des Route Handlers Node (jamais l'Edge Runtime), même choix que le reste
  // du projet pour les opérations serveur sensibles.
  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const expected = createHmac("sha256", secret).update(`${timestampHeader}.${rawBody}`).digest("hex");

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, signatureBuffer);
}
