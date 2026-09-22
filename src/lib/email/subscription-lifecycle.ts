import { sendTransactionalEmail } from "./brevo";

/**
 * Emails du cycle de vie d'un abonnement — créés le 22/09/2026 en même temps
 * que `src/lib/subscription-lifecycle.ts` (voir ce fichier pour le
 * déclenchement, via la tâche planifiée `/api/cron/subscription-lifecycle`).
 *
 * Avant ça, un vendeur dont l'abonnement (ou le mois d'essai Pro) expirait
 * n'était prévenu que passivement, en revisitant son dashboard (bannière de
 * `dashboard/layout.tsx`) — aucun signal actif si le vendeur ne se
 * reconnectait pas, et donc aucune vraie chance de renouveler avant la
 * rétrogradation. Ces deux emails comblent ça, sur le même canal gratuit
 * (Brevo, 300 emails/jour) déjà utilisé pour les autres notifications.
 */

const CONTACT_EMAIL = "contactkevashop@gmail.com";
const dateFR = (iso: string) => new Date(iso).toLocaleDateString("fr-FR");

/**
 * Envoyé une seule fois, le jour où l'abonnement (payant ou essai Pro)
 * vient d'expirer et entre en période de grâce — avant tout blocage réel.
 */
export async function sendSubscriptionGracePeriodEmail({
  to,
  shopName,
  planName,
  wasTrial,
  graceEndsAt,
}: {
  to: string;
  shopName: string;
  planName: string;
  wasTrial: boolean;
  graceEndsAt: string;
}): Promise<boolean> {
  const intro = wasTrial
    ? `Ton mois d'essai gratuit du plan ${planName} sur KEVA vient de se terminer.`
    : `Ton abonnement ${planName} sur KEVA vient d'expirer.`;

  const result = await sendTransactionalEmail({
    to,
    subject: `${shopName} — il te reste 7 jours avant le passage au plan gratuit`,
    html: `
      <p>Bonjour,</p>
      <p>${intro}</p>
      <p>
        Tu as jusqu'au <strong>${dateFR(graceEndsAt)}</strong> pour le
        renouveler. D'ici là, rien ne change : ta boutique et tes produits
        restent visibles normalement.
      </p>
      <p>
        Si tu ne renouvelles pas avant cette date, ta boutique passera
        automatiquement au plan <strong>Starter (gratuit)</strong> : 2
        produits actifs maximum (les plus anciens resteront en ligne, les
        autres seront mis en pause — jamais supprimés), sans gestion de
        stock ni variantes. Tu pourras tout réactiver à tout moment en
        repassant à un plan payant.
      </p>
      <p>
        Le paiement automatique n'est pas encore disponible — pour
        renouveler, écris-nous à
        <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.
      </p>
      <p style="color:#888;font-size:12px;">Boutique : ${shopName}</p>
    `,
  });

  return result.ok;
}

/**
 * Envoyé une seule fois, au moment où la rétrogradation automatique vers
 * Starter est effectivement appliquée (période de grâce entièrement
 * écoulée sans renouvellement).
 */
export async function sendSubscriptionDowngradedEmail({
  to,
  shopName,
  previousPlanName,
  wasTrial,
  deactivatedCount,
}: {
  to: string;
  shopName: string;
  previousPlanName: string;
  wasTrial: boolean;
  deactivatedCount: number;
}): Promise<boolean> {
  const reason = wasTrial
    ? `ton mois d'essai gratuit du plan ${previousPlanName}`
    : `ton abonnement ${previousPlanName}`;

  const productsNote =
    deactivatedCount > 0
      ? `Comme le plan Starter est limité à 2 produits actifs, <strong>${deactivatedCount} produit${
          deactivatedCount > 1 ? "s" : ""
        }</strong> parmi les plus récents ${
          deactivatedCount > 1 ? "ont" : "a"
        } été mis en pause automatiquement — invisibles pour tes clients, mais toujours dans ton espace vendeur. Rien n'a été supprimé.`
      : `Tu avais déjà 2 produits actifs ou moins, rien n'a changé de ce côté.`;

  const result = await sendTransactionalEmail({
    to,
    subject: `${shopName} — ta boutique est passée au plan Starter (gratuit)`,
    html: `
      <p>Bonjour,</p>
      <p>
        ${reason.charAt(0).toUpperCase() + reason.slice(1)} n'a pas été
        renouvelé après la période de grâce : ta boutique est donc passée
        automatiquement au plan <strong>Starter (gratuit)</strong>.
      </p>
      <p>${productsNote}</p>
      <p>
        Tu peux tout réactiver quand tu veux en repassant à un plan payant
        (Business ou Pro) — écris-nous à
        <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.
      </p>
      <p style="color:#888;font-size:12px;">Boutique : ${shopName}</p>
    `,
  });

  return result.ok;
}
