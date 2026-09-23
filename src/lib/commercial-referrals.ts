import type { createClient } from "@/lib/supabase/server";

/**
 * Parrainage COMMERCIAL (23/09/2026, suite du parrainage vendeur —
 * src/lib/referrals.ts — voir supabase/migrations/0046_commercial_referral_system.sql
 * pour le schéma et le contexte complet). Isaac embauche des commerciaux
 * dont le métier est de démarcher des vendeurs pour qu'ils s'abonnent,
 * rémunérés en argent réel, PAS en jours d'abonnement offerts comme le
 * parrainage vendeur — deux mécaniques volontairement séparées.
 *
 * Décision tranchée avec Isaac (AskUserQuestion) : commission versée à
 * CHAQUE paiement (pas une seule fois) — 500 FCFA par abonnement Business
 * (2500 FCFA), 1500 FCFA par abonnement Pro (7000 FCFA). Chaque appel
 * réussi crée donc une ligne dans `commercial_commission_events`, jamais un
 * total mis à jour en place — un vrai ledger d'événements, un par paiement.
 *
 * Appelée EXPLICITEMENT depuis les deux mêmes endroits que
 * `maybeGrantReferralReward` : l'assignation manuelle admin
 * (`admin/abonnements/actions.ts`) et le webhook CinetPay ACCEPTED
 * (`api/cinetpay/webhook/route.ts`) — l'idempotence de ces deux appelants
 * (un clic admin = un événement, un webhook déjà protégé par
 * `payment.status === "success"`) suffit à garantir qu'on ne crée jamais
 * deux lignes pour le même paiement réel, sans verrou supplémentaire ici.
 *
 * Isaac paie ses commerciaux lui-même, en dehors de l'app (Wave/mobile
 * money) — cette fonction ne fait JAMAIS de virement réel, elle tient
 * uniquement le compteur de ce qui est dû (`paid_at` posé plus tard, à la
 * main, depuis /admin/commerciaux).
 */
export const COMMERCIAL_COMMISSION_BY_PLAN_CODE: Record<string, number> = {
  business: 500,
  pro: 1500,
};

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * À appeler juste après un `applyPlanToShop(supabase, referredShopId, ...)`
 * réussi, avec le CODE du plan réellement assigné (`ApplyPlanResult.planCode`
 * — pas l'id, contrairement à `maybeGrantReferralReward` : la commission
 * dépend du palier, pas du prix générique). Ne fait rien si :
 * - le plan n'ouvre droit à aucune commission (Starter, ou un futur plan non
 *   listé dans `COMMERCIAL_COMMISSION_BY_PLAN_CODE`) ;
 * - cette boutique n'a pas été recrutée par un commercial
 *   (`commercial_referrals`).
 */
export async function maybeCreditCommercialCommission(
  supabase: SupabaseClient,
  referredShopId: string,
  planCode: string
): Promise<void> {
  const amount = COMMERCIAL_COMMISSION_BY_PLAN_CODE[planCode];
  if (!amount) return;

  const { data: referral } = await supabase
    .from("commercial_referrals")
    .select("commercial_id")
    .eq("referred_shop_id", referredShopId)
    .maybeSingle();

  if (!referral) return;

  await supabase.from("commercial_commission_events").insert({
    commercial_id: referral.commercial_id,
    referred_shop_id: referredShopId,
    plan_code: planCode,
    amount,
  });
}
