import type { createClient } from "@/lib/supabase/server";

/**
 * Système de parrainage vendeur (23/09/2026, demande d'Isaac : "je veux
 * ajouter un système de parrainage"). Décisions tranchées avec lui avant
 * d'écrire quoi que ce soit (AskUserQuestion) — voir aussi
 * supabase/migrations/0045_referral_system.sql pour la partie schéma :
 * - Déclencheur : le FILLEUL passe sur un plan PAYANT (Business/Pro) —
 *   jamais la création de boutique seule, ni une première commande, ni le
 *   mois d'essai Pro gratuit offert à toute nouvelle boutique
 *   (`start_free_subscription`) qui n'est ni un paiement ni un choix du
 *   vendeur.
 * - Récompense : prolonge de `REFERRAL_REWARD_DAYS` le plan ACTUEL de la
 *   boutique si elle est déjà payante (ou en essai), sinon la fait passer de
 *   Starter à Pro pour la même durée — appliquée aux DEUX boutiques
 *   (filleul et parrain).
 *
 * `maybeGrantReferralReward` est appelée EXPLICITEMENT depuis les deux seuls
 * endroits qui représentent un vrai paiement confirmé :
 * - admin/abonnements/actions.ts (`assignPlan`, après encaissement manuel)
 * - api/cinetpay/webhook/route.ts (statut ACCEPTED confirmé par l'API)
 *
 * Jamais depuis `applyPlanToShop` elle-même (src/lib/subscription.ts,
 * fonction commune déjà critique, testée par les deux appelants ci-dessus —
 * on évite d'y coupler une logique métier annexe) ni depuis
 * `subscription-lifecycle.ts` (rétrogradation automatique Starter, jamais un
 * paiement). Manipule directement la table `subscriptions` plutôt que de
 * rappeler `applyPlanToShop` en boucle, pour ne jamais risquer une chaîne
 * récursive si un parrain était lui-même le filleul de quelqu'un d'autre.
 */
export const REFERRAL_REWARD_DAYS = 30;

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * À appeler juste après un `applyPlanToShop(supabase, referredShopId, ...)`
 * réussi, avec l'id du plan réellement assigné (`ApplyPlanResult.planId`).
 * Ne fait rien (silencieusement) si :
 * - le plan assigné est gratuit (Starter, price = 0) — jamais un paiement ;
 * - aucune ligne `referrals` non récompensée n'existe pour ce filleul (pas
 *   parrainé, ou déjà récompensé une première fois).
 */
export async function maybeGrantReferralReward(
  supabase: SupabaseClient,
  referredShopId: string,
  planId: string
): Promise<void> {
  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("price")
    .eq("id", planId)
    .maybeSingle();

  // Plan gratuit (Starter) : jamais un paiement, jamais de récompense.
  if (!plan || plan.price <= 0) return;

  const { data: referral } = await supabase
    .from("referrals")
    .select("id, referrer_shop_id")
    .eq("referred_shop_id", referredShopId)
    .is("rewarded_at", null)
    .maybeSingle();

  if (!referral) return;

  // Verrou atomique : si un appel concurrent (webhook rejoué, double clic
  // admin) a déjà posé `rewarded_at` entre le select ci-dessus et cet
  // update, celui-ci ne touche aucune ligne (`.is("rewarded_at", null)`
  // répété) et `updated` reste vide — on ne récompense jamais deux fois.
  const { data: updated } = await supabase
    .from("referrals")
    .update({ rewarded_at: new Date().toISOString() })
    .eq("id", referral.id)
    .is("rewarded_at", null)
    .select("id")
    .maybeSingle();

  if (!updated) return;

  await Promise.all([
    extendOrUpgradeShop(supabase, referredShopId),
    extendOrUpgradeShop(supabase, referral.referrer_shop_id),
  ]);
}

/**
 * Applique la récompense à UNE boutique (filleul ou parrain, même
 * traitement pour les deux) : prolonge son plan actuel de
 * `REFERRAL_REWARD_DAYS` s'il est déjà payant, sinon la fait passer de
 * Starter à Pro pour la même durée.
 */
async function extendOrUpgradeShop(supabase: SupabaseClient, shopId: string): Promise<void> {
  const { data: current } = await supabase
    .from("subscriptions")
    .select("id, expires_at, plan:subscription_plans(price)")
    .eq("shop_id", shopId)
    .maybeSingle();

  const currentPlan = Array.isArray(current?.plan) ? current?.plan[0] : current?.plan;
  const isCurrentlyPaid = (currentPlan?.price ?? 0) > 0;

  if (current && isCurrentlyPaid) {
    // Déjà payant : prolonge à partir de la date d'expiration actuelle si
    // elle est encore future, sinon à partir de maintenant — une boutique
    // déjà expirée ne doit jamais cumuler des jours dans le passé.
    const baseMs = Math.max(new Date(current.expires_at).getTime(), Date.now());
    const newExpiresAt = new Date(
      baseMs + REFERRAL_REWARD_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    await supabase.from("subscriptions").update({ expires_at: newExpiresAt }).eq("id", current.id);
    return;
  }

  // Starter (ou aucun abonnement) : bascule sur Pro pour la durée de la
  // récompense. Upsert sur `shop_id` — même contrainte unique que
  // `applyPlanToShop` (migration 0036) — mais sans passer par elle : un
  // upgrade Starter→Pro n'a jamais de produit en excédent à désactiver, donc
  // rien de la logique de downgrade de `applyPlanToShop` n'est utile ici, et
  // ça évite tout risque d'appel récursif vers cette même fonction.
  const { data: proPlan } = await supabase
    .from("subscription_plans")
    .select("id")
    .eq("code", "pro")
    .maybeSingle();

  if (!proPlan) return;

  const expiresAt = new Date(Date.now() + REFERRAL_REWARD_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await supabase.from("subscriptions").upsert(
    {
      shop_id: shopId,
      plan_id: proPlan.id,
      status: "active",
      started_at: new Date().toISOString(),
      expires_at: expiresAt,
      is_trial: false,
    },
    { onConflict: "shop_id" }
  );
}
