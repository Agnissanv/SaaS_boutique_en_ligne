"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { syncPartnerGift } from "@/lib/partners-server";

export type AcceptInvitationState = { error?: string };

/**
 * Acceptation d'une invitation partenaire (13/10/2026, option A choisie par
 * Isaac : lien à usage unique valable 7 jours, envoyé par WhatsApp). La
 * partenaire choisit elle-même son nom affiché, son code et son numéro de
 * paiement ; `accept_partner_invitation` vérifie tout (jeton, expiration,
 * compte vendeur, code libre) et renvoie un message lisible en cas de refus.
 * Si elle a déjà une boutique, elle reçoit aussitôt le Pro offert.
 */
export async function acceptPartnerInvitation(
  token: string,
  _prev: AcceptInvitationState,
  formData: FormData
): Promise<AcceptInvitationState> {
  if (formData.get("contrat") !== "on") {
    return { error: "Confirme que tu as signé le contrat de partenariat." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Connecte-toi pour accepter l'invitation." };

  const { data: partnerId, error } = await supabase.rpc("accept_partner_invitation", {
    p_token: token,
    p_display_name: formData.get("display_name")?.toString() ?? "",
    p_code: formData.get("code")?.toString() ?? "",
    p_payout_method: formData.get("payout_method")?.toString() ?? "",
    p_payout_phone: formData.get("payout_phone")?.toString() ?? "",
  });
  if (error || !partnerId) {
    // Les refus de `accept_partner_invitation` sont des messages pensés pour
    // être affichés tels quels (code pris, invitation expirée...).
    // Toute autre erreur (réseau, contrainte inattendue) reste générique.
    if (error && error.code !== "P0001") console.error("acceptPartnerInvitation — erreur Supabase:", error);
    return {
      error: error?.code === "P0001" ? error.message : "Impossible d'accepter l'invitation. Réessaie.",
    };
  }

  await syncPartnerGift(partnerId);
  redirect("/partenaire");
}
