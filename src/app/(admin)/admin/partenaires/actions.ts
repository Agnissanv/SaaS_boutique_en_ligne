"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { syncPartnerGift } from "@/lib/partners-server";
import type { Json } from "@/lib/types/database";

/**
 * Actions admin du programme partenaire (13/10/2026) — voir
 * supabase/migrations/0061_partner_program.sql. Isaac garde la main sur ce
 * que la partenaire ne peut pas changer elle-même : montants, dates, fin du
 * partenariat, versements, corrections d'attribution.
 */

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return profile?.role === "admin" ? { supabase, userId: user.id } : null;
}

const INVITE_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000;
const NOTICE_DAYS = 7;

function newInvite() {
  return {
    invite_token: randomBytes(24).toString("base64url"),
    invite_expires_at: new Date(Date.now() + INVITE_VALIDITY_MS).toISOString(),
  };
}

function readAmount(formData: FormData, name: string): number | null {
  const value = Number(formData.get(name));
  return Number.isInteger(value) && value >= 0 && value <= 1_000_000 ? value : null;
}

function readDate(formData: FormData, name: string): string | null {
  const value = formData.get(name)?.toString() ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

async function logAction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  action: string,
  metadata: { [key: string]: Json | undefined }
) {
  await supabase.from("transaction_logs").insert({ actor_id: userId, shop_id: null, action, metadata });
}

export type PartnerFormState = { error?: string; success?: string };

/** Nouvelle invitation : libellé interne, montants, date de début. */
export async function createPartnerInvitation(
  _prev: PartnerFormState,
  formData: FormData
): Promise<PartnerFormState> {
  const admin = await requireAdmin();
  if (!admin) return { error: "Accès refusé." };

  const label = formData.get("label")?.toString().trim() ?? "";
  const business = readAmount(formData, "business_commission");
  const pro = readAmount(formData, "pro_commission");
  const startsOn = readDate(formData, "starts_on");
  if (!label || label.length > 80) return { error: "Indique un nom (80 caractères au plus)." };
  if (business === null || pro === null) return { error: "Montants de commission invalides." };
  if (!startsOn) return { error: "Date de début invalide." };

  const { data, error } = await admin.supabase
    .from("partners")
    .insert({ label, business_commission: business, pro_commission: pro, starts_on: startsOn, ...newInvite() })
    .select("id")
    .single();
  if (error || !data) {
    console.error("createPartnerInvitation — erreur Supabase:", error);
    return { error: "Impossible de créer l'invitation. Réessaie." };
  }
  await logAction(admin.supabase, admin.userId, "partner_invited", { partner_id: data.id, label });
  redirect(`/admin/partenaires/${data.id}`);
}

/** Nouveau lien d'invitation (l'ancien cesse de fonctionner). */
export async function regeneratePartnerInvitation(partnerId: string) {
  const admin = await requireAdmin();
  if (!admin) return;
  await admin.supabase.from("partners").update(newInvite()).eq("id", partnerId).is("accepted_at", null);
  revalidatePath(`/admin/partenaires/${partnerId}`);
}

/** Montants, dates et libellé (le partenariat continue). */
export async function updatePartnerTerms(
  partnerId: string,
  _prev: PartnerFormState,
  formData: FormData
): Promise<PartnerFormState> {
  const admin = await requireAdmin();
  if (!admin) return { error: "Accès refusé." };

  const label = formData.get("label")?.toString().trim() ?? "";
  const business = readAmount(formData, "business_commission");
  const pro = readAmount(formData, "pro_commission");
  const startsOn = readDate(formData, "starts_on");
  if (!label || label.length > 80) return { error: "Indique un nom (80 caractères au plus)." };
  if (business === null || pro === null) return { error: "Montants de commission invalides." };
  if (!startsOn) return { error: "Date de début invalide." };

  const { error } = await admin.supabase
    .from("partners")
    .update({
      label,
      business_commission: business,
      pro_commission: pro,
      starts_on: startsOn,
      updated_at: new Date().toISOString(),
    })
    .eq("id", partnerId);
  if (error) return { error: "Impossible d'enregistrer. Réessaie." };

  await syncPartnerGift(partnerId);
  await logAction(admin.supabase, admin.userId, "partner_terms_updated", {
    partner_id: partnerId,
    business_commission: business,
    pro_commission: pro,
    starts_on: startsOn,
  });
  revalidatePath(`/admin/partenaires/${partnerId}`);
  return { success: "Conditions enregistrées." };
}

/**
 * Fin du partenariat avec le préavis de 7 jours du contrat (article 9). Rien
 * n'est supprimé : à la date de fin, plus aucun clic, rattachement ni
 * commission ; le Pro offert s'arrête à cette date.
 */
export async function endPartnership(partnerId: string) {
  const admin = await requireAdmin();
  if (!admin) return;
  const endsOn = new Date(Date.now() + NOTICE_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await admin.supabase
    .from("partners")
    .update({ ends_on: endsOn, updated_at: new Date().toISOString() })
    .eq("id", partnerId);
  await syncPartnerGift(partnerId);
  await logAction(admin.supabase, admin.userId, "partner_ended", { partner_id: partnerId, ends_on: endsOn });
  revalidatePath(`/admin/partenaires/${partnerId}`);
  revalidatePath("/admin/partenaires");
}

/** Reprise du partenariat : tout repart (liens, code, boutiques déjà rattachées, Pro offert). */
export async function reactivatePartnership(partnerId: string) {
  const admin = await requireAdmin();
  if (!admin) return;
  await admin.supabase
    .from("partners")
    .update({ ends_on: null, updated_at: new Date().toISOString() })
    .eq("id", partnerId);
  await syncPartnerGift(partnerId);
  await logAction(admin.supabase, admin.userId, "partner_reactivated", { partner_id: partnerId });
  revalidatePath(`/admin/partenaires/${partnerId}`);
  revalidatePath("/admin/partenaires");
}

/**
 * L'invitation a été acceptée par la mauvaise personne : le compte perd
 * l'accès partenaire, ses codes sont libérés, le Pro offert à sa boutique
 * s'arrête, et un nouveau lien d'invitation est créé.
 */
export async function revokePartnerAcceptance(partnerId: string) {
  const admin = await requireAdmin();
  if (!admin) return;
  const { data: partner } = await admin.supabase
    .from("partners")
    .select("gifted_shop_id")
    .eq("id", partnerId)
    .maybeSingle();

  if (partner?.gifted_shop_id) {
    // Clé service role : l'abonnement d'une boutique n'est modifiable par
    // personne d'autre que le serveur (même règle que applyPlanToShop).
    await createServiceRoleClient()
      .from("subscriptions")
      .update({ expires_at: new Date().toISOString() })
      .eq("shop_id", partner.gifted_shop_id);
  }
  await admin.supabase.from("partner_codes").delete().eq("partner_id", partnerId);
  await admin.supabase
    .from("partners")
    .update({
      profile_id: null,
      display_name: null,
      code: null,
      payout_method: null,
      payout_phone: null,
      payout_updated_at: null,
      accepted_at: null,
      gifted_shop_id: null,
      updated_at: new Date().toISOString(),
      ...newInvite(),
    })
    .eq("id", partnerId);
  await logAction(admin.supabase, admin.userId, "partner_acceptance_revoked", { partner_id: partnerId });
  revalidatePath(`/admin/partenaires/${partnerId}`);
}

/** Versement fait (Wave / Mobile Money) : solde le reste dû du mois. */
export async function markPartnerMonthPaid(partnerId: string, month: string, formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) return;
  if (!/^\d{4}-\d{2}-01$/.test(month)) return;

  const [{ data: events }, { data: payouts }] = await Promise.all([
    admin.supabase.from("partner_commission_events").select("amount").eq("partner_id", partnerId).eq("period_month", month),
    admin.supabase.from("partner_payouts").select("amount").eq("partner_id", partnerId).eq("period_month", month),
  ]);
  const due =
    (events ?? []).reduce((sum, e) => sum + e.amount, 0) - (payouts ?? []).reduce((sum, p) => sum + p.amount, 0);
  if (due <= 0) return;

  const reference = formData.get("reference")?.toString().trim().slice(0, 120) || null;
  await admin.supabase.from("partner_payouts").insert({
    partner_id: partnerId,
    period_month: month,
    amount: due,
    reference,
    paid_by: admin.userId,
  });
  await logAction(admin.supabase, admin.userId, "partner_payout", { partner_id: partnerId, month, amount: due });
  revalidatePath(`/admin/partenaires/${partnerId}`);
  revalidatePath("/admin/partenaires");
}

/**
 * Rattachement manuel (« j'avais utilisé son code mais j'ai oublié de le
 * saisir ») : même règle qu'ailleurs, une boutique n'est jamais rattachée à
 * deux personnes, et jamais à la partenaire elle-même.
 */
export async function attachShopToPartner(
  partnerId: string,
  _prev: PartnerFormState,
  formData: FormData
): Promise<PartnerFormState> {
  const admin = await requireAdmin();
  if (!admin) return { error: "Accès refusé." };

  const slug = (formData.get("shop")?.toString() ?? "")
    .trim()
    .replace(/^https?:\/\/[^/]+\//, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
  if (!slug) return { error: "Indique le lien ou l'identifiant de la boutique." };

  const { data: shop } = await admin.supabase.from("shops").select("id, name, owner_id").eq("slug", slug).maybeSingle();
  if (!shop) return { error: "Aucune boutique avec cet identifiant." };

  const [{ data: partner }, partnerRef, commercialRef, vendorRef] = await Promise.all([
    admin.supabase.from("partners").select("profile_id").eq("id", partnerId).maybeSingle(),
    admin.supabase.from("partner_referrals").select("id").eq("referred_shop_id", shop.id).maybeSingle(),
    admin.supabase.from("commercial_referrals").select("id").eq("referred_shop_id", shop.id).maybeSingle(),
    admin.supabase.from("referrals").select("id").eq("referred_shop_id", shop.id).maybeSingle(),
  ]);
  if (partner?.profile_id && partner.profile_id === shop.owner_id) {
    return { error: "C'est la boutique de la partenaire elle-même." };
  }
  if (partnerRef.data || commercialRef.data || vendorRef.data) {
    return { error: `${shop.name} est déjà rattachée à un partenaire, un commercial ou un parrain.` };
  }

  const { error } = await admin.supabase
    .from("partner_referrals")
    .insert({ partner_id: partnerId, referred_shop_id: shop.id, source: "admin" });
  if (error) return { error: "Impossible de rattacher cette boutique. Réessaie." };

  await logAction(admin.supabase, admin.userId, "partner_shop_attached", { partner_id: partnerId, shop_id: shop.id });
  revalidatePath(`/admin/partenaires/${partnerId}`);
  return { success: `${shop.name} est maintenant rattachée.` };
}

/** Retire un rattachement erroné (les commissions déjà créditées restent). */
export async function detachShopFromPartner(partnerId: string, referralId: string) {
  const admin = await requireAdmin();
  if (!admin) return;
  await admin.supabase.from("partner_referrals").delete().eq("id", referralId).eq("partner_id", partnerId);
  await logAction(admin.supabase, admin.userId, "partner_shop_detached", { partner_id: partnerId, referral_id: referralId });
  revalidatePath(`/admin/partenaires/${partnerId}`);
}

/**
 * Suppression d'un partenaire de TEST (ou d'une invitation jamais utilisée) :
 * refusée dès qu'une commission ou un versement existe — un vrai partenaire
 * se termine (`endPartnership`), il ne se supprime pas. Le Pro offert
 * éventuel s'arrête ; codes, clics et rattachements partent avec la fiche.
 */
export async function deletePartner(partnerId: string) {
  const admin = await requireAdmin();
  if (!admin) return;

  const [{ count: eventCount }, { count: payoutCount }, { data: partner }] = await Promise.all([
    admin.supabase.from("partner_commission_events").select("id", { count: "exact", head: true }).eq("partner_id", partnerId),
    admin.supabase.from("partner_payouts").select("id", { count: "exact", head: true }).eq("partner_id", partnerId),
    admin.supabase.from("partners").select("label, gifted_shop_id").eq("id", partnerId).maybeSingle(),
  ]);
  if (!partner || (eventCount ?? 0) > 0 || (payoutCount ?? 0) > 0) return;

  if (partner.gifted_shop_id) {
    await createServiceRoleClient()
      .from("subscriptions")
      .update({ expires_at: new Date().toISOString() })
      .eq("shop_id", partner.gifted_shop_id);
  }
  await admin.supabase.from("partners").delete().eq("id", partnerId);
  await logAction(admin.supabase, admin.userId, "partner_deleted", { partner_id: partnerId, label: partner.label });
  revalidatePath("/admin/partenaires");
  redirect("/admin/partenaires");
}
