import { createServiceRoleClient } from "@/lib/supabase/server";
import { applyPlanToShop } from "@/lib/subscription";

/**
 * Lectures serveur du programme partenaire qui dépassent ce que la RLS laisse
 * voir à une vendeuse (elle ne lit jamais `partner_referrals`, réservée à
 * l'admin). À n'appeler qu'APRÈS avoir vérifié que l'utilisateur connecté
 * est bien propriétaire de la boutique. Séparé de src/lib/partners.ts, qui
 * est aussi importé côté navigateur.
 */

export type ShopPartnerCodeState =
  | { kind: "attributed"; partnerName: string }
  | { kind: "eligible" }
  | { kind: "hidden" };

/**
 * Faut-il proposer « Tu as un code partenaire ? » sur la page Abonnement ?
 * Seulement si la boutique n'est rattachée à personne (partenaire, commercial
 * ou parrain), n'a jamais payé, et n'appartient pas elle-même à une
 * partenaire.
 */
export async function getShopPartnerCodeState(
  shopId: string,
  ownerId: string
): Promise<ShopPartnerCodeState> {
  const supabase = createServiceRoleClient();

  const [partnerReferral, commercialReferral, vendorReferral, ownPartner, paidPayment, subscription] =
    await Promise.all([
      supabase
        .from("partner_referrals")
        .select("partner:partners(display_name, code)")
        .eq("referred_shop_id", shopId)
        .maybeSingle(),
      supabase.from("commercial_referrals").select("id").eq("referred_shop_id", shopId).maybeSingle(),
      supabase.from("referrals").select("id").eq("referred_shop_id", shopId).maybeSingle(),
      supabase.from("partners").select("id").eq("profile_id", ownerId).maybeSingle(),
      supabase
        .from("payments")
        .select("id")
        .eq("shop_id", shopId)
        .eq("status", "success")
        .is("order_id", null)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("subscriptions")
        .select("is_trial, plan:subscription_plans(code)")
        .eq("shop_id", shopId)
        .maybeSingle(),
    ]);

  if (partnerReferral.data) {
    const partner = Array.isArray(partnerReferral.data.partner)
      ? partnerReferral.data.partner[0]
      : partnerReferral.data.partner;
    return { kind: "attributed", partnerName: partner?.display_name ?? partner?.code ?? "partenaire KEVA" };
  }
  if (commercialReferral.data || vendorReferral.data || ownPartner.data || paidPayment.data) {
    return { kind: "hidden" };
  }
  const plan = Array.isArray(subscription.data?.plan) ? subscription.data?.plan[0] : subscription.data?.plan;
  if (subscription.data && !subscription.data.is_trial && (plan?.code === "business" || plan?.code === "pro")) {
    return { kind: "hidden" };
  }
  return { kind: "eligible" };
}

// Pro offert sans date de fin connue : prolongé loin dans le temps, puis
// ramené à la date de fin dès qu'Isaac met fin au partenariat (préavis).
const GIFT_OPEN_ENDED_DAYS = 3650;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Aligne le Pro offert de la boutique d'une partenaire sur l'état du
 * partenariat. À appeler après chaque événement qui le change : invitation
 * acceptée, boutique créée par la partenaire, fin programmée ou réactivation
 * par l'admin.
 * - partenariat actif : Pro jusqu'à la date de fin (ou sans fin connue) ;
 * - partenariat terminé : rien à faire, l'abonnement s'arrête de lui-même à
 *   la date de fin et la boutique repasse en formule gratuite comme pour
 *   n'importe quelle vendeuse.
 * Jamais une commission : ce n'est pas un paiement (on n'appelle pas les
 * fonctions de crédit).
 */
export async function syncPartnerGift(partnerId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data: partner } = await supabase
    .from("partners")
    .select("id, profile_id, ends_on, gifted_shop_id")
    .eq("id", partnerId)
    .maybeSingle();
  if (!partner?.profile_id) return;

  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .eq("owner_id", partner.profile_id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!shop) return;

  const { data: active } = await supabase.rpc("partner_is_active", { p_partner_id: partnerId });
  if (!active) return;

  const days = partner.ends_on
    ? Math.max(0, (Date.parse(`${partner.ends_on}T00:00:00Z`) - Date.now()) / DAY_MS)
    : GIFT_OPEN_ENDED_DAYS;
  const result = await applyPlanToShop(supabase, shop.id, "pro", days);
  if (!result) return;

  if (partner.gifted_shop_id !== shop.id) {
    await supabase.from("partners").update({ gifted_shop_id: shop.id }).eq("id", partnerId);
  }
  await supabase.from("transaction_logs").insert({
    actor_id: null,
    shop_id: shop.id,
    action: "partner_pro_gift",
    metadata: { partner_id: partnerId, expires_at: result.expiresAt },
  });
}
