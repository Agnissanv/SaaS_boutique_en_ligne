import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type MyPartner = {
  id: string;
  displayName: string;
  code: string;
  payoutMethod: string | null;
  payoutPhone: string | null;
  businessCommission: number;
  proCommission: number;
  startsOn: string;
  endsOn: string | null;
  acceptedAt: string | null;
  isActive: boolean;
};

/**
 * Fiche partenaire du compte connecté (lecture autorisée par la RLS
 * `partners_self_read`), partagée par le layout et les pages de l'espace
 * partenaire — `cache` évite de la relire plusieurs fois par requête. Renvoie
 * vers la connexion si personne n'est connecté, vers le tableau de bord
 * vendeur si le compte n'est pas partenaire.
 */
export const getMyPartner = cache(async (): Promise<MyPartner> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?suite=/partenaire");

  const { data: partner } = await supabase
    .from("partners")
    .select(
      "id, display_name, code, payout_method, payout_phone, business_commission, pro_commission, starts_on, ends_on, accepted_at"
    )
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!partner || !partner.code) redirect("/dashboard");

  const { data: isActive } = await supabase.rpc("partner_is_active", { p_partner_id: partner.id });

  return {
    id: partner.id,
    displayName: partner.display_name ?? partner.code,
    code: partner.code,
    payoutMethod: partner.payout_method,
    payoutPhone: partner.payout_phone,
    businessCommission: partner.business_commission,
    proCommission: partner.pro_commission,
    startsOn: partner.starts_on,
    endsOn: partner.ends_on,
    acceptedAt: partner.accepted_at,
    isActive: Boolean(isActive),
  };
});

/** « 13 octobre 2026 » à partir d'une date AAAA-MM-JJ. */
export function formatDay(isoDate: string): string {
  return new Date(`${isoDate.slice(0, 10)}T12:00:00Z`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** « octobre 2026 » à partir d'un premier jour du mois AAAA-MM-01. */
export function formatMonth(monthStart: string): string {
  return new Date(`${monthStart.slice(0, 10)}T12:00:00Z`).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}

/** Date limite de versement d'un mois (le 7 du mois suivant, article 5 du contrat). */
export function payoutDeadline(monthStart: string): string {
  const [year, month] = monthStart.split("-").map(Number);
  return new Date(Date.UTC(year, month, 7)).toISOString().slice(0, 10);
}

export function fcfa(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} F`;
}
