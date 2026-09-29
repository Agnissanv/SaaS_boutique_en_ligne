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
 * (`admin/abonnements/actions.ts`, jamais de `paymentId` — encaissement
 * hors-app, aucune ligne `payments`) et le webhook Nyole payment.completed
 * (`api/nyole/webhook/route.ts`, basculé depuis CinetPay le 28/09/2026, lui
 * passe `payment.id`).
 *
 * **Verrou d'idempotence (30/09/2026, correctif d'audit)** : la version
 * précédente ne posait aucun verrou, en s'appuyant sur l'argument que le
 * webhook vérifie déjà `payment.status === "success"` avant d'appeler cette
 * fonction. Cet argument était faux en pratique : dans le webhook, ce check
 * lit `payments.status` puis, plus bas, le POSE à 'success' — deux étapes
 * séparées, pas une opération atomique. Nyole peut retenter un même
 * événement jusqu'à 10 fois sur ~72h ; deux livraisons suffisamment proches
 * pouvaient toutes les deux lire un statut pas encore 'success' et donc
 * créditer deux fois la même commission réelle. Corrigé via
 * `payment_id` (migration 0050) : contrainte unique partielle
 * (`where payment_id is not null`) sur `commercial_commission_events` — un
 * même paiement ne peut plus jamais générer deux lignes, quel que soit le
 * nombre de rejeux du webhook. Le code 23505 (violation de cette contrainte)
 * est donc un cas attendu ici, pas une erreur — mêmes conventions que le
 * reste du projet (voir dashboard/produits/actions.ts, collaborateurs/actions.ts).
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
 *
 * `paymentId` (optionnel) : l'id de la ligne `payments` à l'origine de ce
 * crédit, quand il y en a une (webhook Nyole). Sert uniquement au verrou
 * d'idempotence ci-dessous — omis (`null`) depuis l'assignation manuelle
 * admin, qui n'a pas de ligne `payments`.
 */
export async function maybeCreditCommercialCommission(
  supabase: SupabaseClient,
  referredShopId: string,
  planCode: string,
  paymentId: string | null = null
): Promise<void> {
  const amount = COMMERCIAL_COMMISSION_BY_PLAN_CODE[planCode];
  if (!amount) return;

  const { data: referral } = await supabase
    .from("commercial_referrals")
    .select("commercial_id")
    .eq("referred_shop_id", referredShopId)
    .maybeSingle();

  if (!referral) return;

  const { error } = await supabase.from("commercial_commission_events").insert({
    commercial_id: referral.commercial_id,
    referred_shop_id: referredShopId,
    plan_code: planCode,
    amount,
    payment_id: paymentId,
  });

  // 23505 : contrainte unique sur `payment_id` (migration 0050) — un appel
  // concurrent (webhook Nyole rejoué) a déjà inséré la ligne pour ce même
  // paiement. C'est exactement l'effet recherché, on ignore silencieusement.
  if (error && error.code !== "23505") {
    console.error("maybeCreditCommercialCommission — erreur Supabase:", error);
  }
}
