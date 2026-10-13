import type { createClient } from "@/lib/supabase/server";

/**
 * Programme Partenaire Influenceur (13/10/2026) — voir
 * supabase/migrations/0061_partner_program.sql pour les décisions prises
 * avec Isaac (contrat signé avec une créatrice de contenu).
 *
 * Distinct des commerciaux (src/lib/commercial-referrals.ts) : montants
 * propres à chaque partenaire (`partners.business_commission` /
 * `pro_commission`), commission par MOIS d'abonnement payé, liens par réseau
 * social mémorisés 30 jours dans le navigateur, code saisissable à la main.
 */

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export const PARTNER_SOURCES = ["general", "tiktok", "instagram", "facebook"] as const;
export type PartnerLinkSource = (typeof PARTNER_SOURCES)[number];

export const PARTNER_SOURCE_LABELS: Record<string, string> = {
  general: "Lien général",
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  code: "Code saisi",
  admin: "Ajout manuel",
};

export const PAYOUT_METHOD_LABELS: Record<string, string> = {
  wave: "Wave",
  orange_money: "Orange Money",
  mtn_money: "MTN Money",
  moov_money: "Moov Money",
};

/**
 * Cookie posé par la route /p/[code] : `CODE.source` (ex. `DJANDJOU.tiktok`).
 * 30 jours, comme convenu avec Isaac : un visiteur arrivé par le lien d'une
 * partenaire peut se promener sur le site et créer sa boutique plus tard,
 * elle lui reste attribuée. Le premier lien suivi l'emporte (jamais écrasé
 * par le lien d'une autre partenaire).
 */
export const PARTNER_COOKIE = "keva_partner";
export const PARTNER_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

const CODE_PATTERN = /^[A-Z0-9]{3,20}$/;

export function normalizePartnerCode(input: string | null | undefined): string | null {
  const code = (input ?? "").trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

export function normalizePartnerSource(input: string | null | undefined): PartnerLinkSource {
  return (PARTNER_SOURCES as readonly string[]).includes(input ?? "")
    ? (input as PartnerLinkSource)
    : "general";
}

export function serializePartnerCookie(code: string, source: PartnerLinkSource): string {
  return `${code}.${source}`;
}

export function parsePartnerCookie(
  value: string | null | undefined
): { code: string; source: PartnerLinkSource } | null {
  if (!value) return null;
  const [rawCode, rawSource] = value.split(".");
  const code = normalizePartnerCode(rawCode);
  if (!code) return null;
  return { code, source: normalizePartnerSource(rawSource) };
}

/** Premier jour du mois (AAAA-MM-01) décalé de `offset` mois. */
export function monthStart(date: Date, offset = 0): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
  return d.toISOString().slice(0, 10);
}

/**
 * À appeler juste après un `applyPlanToShop(...)` réussi qui correspond à un
 * VRAI paiement (webhook Nyole, ou assignation manuelle admin après un
 * paiement reçu), avec le code du plan réellement assigné. Crédite une
 * commission par mois payé (`months`, 1 pour un paiement Nyole) si :
 * - la boutique a été amenée par un partenaire (`partner_referrals`) ;
 * - ce partenariat est encore actif aujourd'hui (rien après la fin) ;
 * - le plan ouvre droit à une commission pour ce partenaire (Business/Pro).
 *
 * `paymentId` sert de verrou d'idempotence (index unique paiement + mois,
 * migration 0061) : un webhook rejoué ne crédite jamais deux fois. Ne fait
 * jamais de virement : Isaac paie lui-même par Wave / Mobile Money et
 * l'indique dans /admin/partenaires.
 */
export async function maybeCreditPartnerCommission(
  supabase: SupabaseClient,
  shopId: string,
  planCode: string,
  paymentId: string | null = null,
  months = 1
): Promise<void> {
  if (planCode !== "business" && planCode !== "pro") return;

  const { data: referral } = await supabase
    .from("partner_referrals")
    .select("partner_id, partner:partners(business_commission, pro_commission)")
    .eq("referred_shop_id", shopId)
    .maybeSingle();
  if (!referral) return;

  const partner = Array.isArray(referral.partner) ? referral.partner[0] : referral.partner;
  const amount = planCode === "pro" ? partner?.pro_commission : partner?.business_commission;
  if (!amount || amount <= 0) return;

  const { data: active } = await supabase.rpc("partner_is_active", {
    p_partner_id: referral.partner_id,
  });
  if (!active) return;

  const now = new Date();
  const rows = Array.from({ length: Math.max(1, months) }, (_, index) => ({
    partner_id: referral.partner_id,
    referred_shop_id: shopId,
    plan_code: planCode,
    amount,
    period_month: monthStart(now, index),
    payment_id: paymentId,
    month_index: index,
  }));

  const { error } = await supabase.from("partner_commission_events").insert(rows);
  // 23505 : ce paiement a déjà été crédité (webhook rejoué) — effet voulu.
  if (error && error.code !== "23505") {
    console.error("maybeCreditPartnerCommission — erreur Supabase:", error);
  }
}
