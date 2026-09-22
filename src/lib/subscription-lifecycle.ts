import type { createServiceRoleClient } from "@/lib/supabase/server";
import { applyPlanToShop, SUBSCRIPTION_GRACE_PERIOD_DAYS } from "@/lib/subscription";
import {
  sendSubscriptionGracePeriodEmail,
  sendSubscriptionDowngradedEmail,
} from "@/lib/email/subscription-lifecycle";

/**
 * Rétrogradation automatique + notifications de fin d'abonnement —
 * 22/09/2026, réponse à une question directe d'Isaac ("est-ce qu'il reçoit
 * une notification, et que deviennent ses produits en trop ?"). Avant ça,
 * RIEN ne se passait automatiquement à l'expiration : un abonnement expiré
 * (même après la période de grâce) gardait TOUTES ses fonctionnalités Pro
 * indéfiniment — seul l'ajout de nouveaux produits était bloqué (voir
 * `saveProduct`, produits/actions.ts) — et aucun email n'était jamais
 * envoyé. Sans intervention manuelle d'un admin sur `/admin/abonnements`,
 * un vendeur qui ne payait jamais gardait le plan Pro gratuitement pour
 * toujours après son mois d'essai. Un vrai trou côté revenus, pas qu'un
 * détail UX.
 *
 * Déclenchée une fois par jour par `/api/cron/subscription-lifecycle`
 * (Vercel Cron, gratuit sur le plan Hobby à cette fréquence — voir
 * vercel.json). Deux passes, toutes deux idempotentes SANS colonne de
 * suivi supplémentaire :
 *
 * 1. Abonnement qui vient d'entrer en période de grâce (expiré il y a
 *    moins de 24h) → email d'avertissement. Ne peut matcher qu'un seul
 *    jour de cycle cron (la fenêtre glisse chaque jour), donc pas de
 *    double envoi tant que le cron tourne bien chaque jour — si un jour de
 *    cron est manqué, cet avertissement est simplement perdu (pas de
 *    rattrapage), acceptable pour un simple rappel.
 * 2. Période de grâce entièrement écoulée → rétrogradation vers Starter
 *    via `applyPlanToShop` (même fonction que l'assignation admin/webhook
 *    CinetPay — désactive les produits en excédent, ne supprime jamais
 *    rien) + email de confirmation. Idempotent par construction : une fois
 *    rétrogradée, la boutique est sur le plan Starter (price = 0), donc
 *    exclue de cette passe à la prochaine exécution (voir le filtre
 *    `plan.price === 0` ci-dessous, qui reprend exactement la règle de
 *    `getShopSubscription` dans subscription.ts — un plan gratuit ne
 *    "expire" jamais).
 *
 * Ne traite QUE les boutiques sur un plan payant (price > 0) : une
 * boutique déjà Starter n'a jamais besoin d'être "rétrogradée" ni prévenue
 * une seconde fois.
 */

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 500;

export type LifecycleSummary = {
  shopsChecked: number;
  graceWarningsSent: number;
  downgraded: number;
  errors: string[];
};

type PlanRow = { code: string; name: string; price: number };

type SubRow = {
  expires_at: string;
  is_trial: boolean;
  plan: PlanRow | PlanRow[] | null;
};

type ShopRow = {
  id: string;
  name: string;
  notification_email: string | null;
  owner_id: string;
  subscriptions: SubRow | SubRow[] | null;
};

/**
 * Adresse à notifier : l'email de notification de la boutique s'il est
 * renseigné (optionnel, voir boutique/actions.ts), sinon l'email du compte
 * du vendeur (`auth.users`, accessible uniquement via le client service
 * role) — pour ne jamais rater un vendeur qui n'a simplement jamais
 * configuré ce champ facultatif.
 */
async function resolveNotificationEmail(
  supabase: ReturnType<typeof createServiceRoleClient>,
  shop: Pick<ShopRow, "notification_email" | "owner_id">
): Promise<string | null> {
  if (shop.notification_email) return shop.notification_email;

  const { data } = await supabase.auth.admin.getUserById(shop.owner_id);
  return data?.user?.email ?? null;
}

export async function runSubscriptionLifecycleCheck(
  supabase: ReturnType<typeof createServiceRoleClient>
): Promise<LifecycleSummary> {
  const summary: LifecycleSummary = {
    shopsChecked: 0,
    graceWarningsSent: 0,
    downgraded: 0,
    errors: [],
  };

  const now = Date.now();
  const graceMs = SUBSCRIPTION_GRACE_PERIOD_DAYS * ONE_DAY_MS;

  let from = 0;
  for (;;) {
    // Même pattern que /admin/abonnements (abonnement le plus récent par
    // boutique, résolu explicitement même si la contrainte
    // `subscriptions_shop_id_key` — migration 0036 — garantit déjà une
    // seule ligne par boutique).
    const { data, error } = await supabase
      .from("shops")
      .select(
        "id, name, notification_email, owner_id, subscriptions(expires_at, is_trial, plan:subscription_plans(code, name, price))"
      )
      .order("expires_at", { referencedTable: "subscriptions", ascending: false })
      .limit(1, { referencedTable: "subscriptions" })
      .order("id")
      .range(from, from + BATCH_SIZE - 1);

    if (error) {
      summary.errors.push(`lecture boutiques (offset ${from}) : ${error.message}`);
      break;
    }

    const rows = (data ?? []) as unknown as ShopRow[];
    if (rows.length === 0) break;

    for (const shop of rows) {
      summary.shopsChecked += 1;

      const subs = Array.isArray(shop.subscriptions)
        ? shop.subscriptions
        : shop.subscriptions
          ? [shop.subscriptions]
          : [];
      const sub = subs[0];
      if (!sub) continue;

      const plan = Array.isArray(sub.plan) ? sub.plan[0] : sub.plan;
      // Plan gratuit (price = 0, aujourd'hui Starter) : ne bloque jamais,
      // ne se rétrograde jamais — même règle que getShopSubscription.
      if (!plan || plan.price === 0) continue;

      const expiryMs = new Date(sub.expires_at).getTime();
      const graceEndMs = expiryMs + graceMs;

      try {
        if (now >= graceEndMs) {
          // Période de grâce entièrement écoulée → rétrogradation.
          const result = await applyPlanToShop(supabase, shop.id, "starter");
          if (result) {
            summary.downgraded += 1;
            const email = await resolveNotificationEmail(supabase, shop);
            if (email) {
              await sendSubscriptionDowngradedEmail({
                to: email,
                shopName: shop.name,
                previousPlanName: plan.name,
                wasTrial: sub.is_trial,
                deactivatedCount: result.deactivatedProductIds.length,
              });
            }
          }
        } else if (now >= expiryMs && now - expiryMs < ONE_DAY_MS) {
          // Vient d'entrer en période de grâce aujourd'hui → avertissement.
          const email = await resolveNotificationEmail(supabase, shop);
          if (email) {
            const sent = await sendSubscriptionGracePeriodEmail({
              to: email,
              shopName: shop.name,
              planName: plan.name,
              wasTrial: sub.is_trial,
              graceEndsAt: new Date(graceEndMs).toISOString(),
            });
            if (sent) summary.graceWarningsSent += 1;
          }
        }
      } catch (e) {
        summary.errors.push(`boutique ${shop.id} : ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (rows.length < BATCH_SIZE) break;
    from += BATCH_SIZE;
  }

  return summary;
}
