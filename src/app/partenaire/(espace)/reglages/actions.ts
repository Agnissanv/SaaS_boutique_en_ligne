"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PartnerSettingsState = { error?: string; success?: string };

/**
 * Réglages modifiables par la partenaire elle-même (décision d'Isaac) : nom
 * affiché, code, moyen et numéro de paiement. Toutes les règles (code libre,
 * code figé après la fin du partenariat...) sont dans
 * `update_partner_settings` ; ses refus sont des messages prévus pour être
 * affichés tels quels.
 */
export async function updatePartnerSettings(
  _prev: PartnerSettingsState,
  formData: FormData
): Promise<PartnerSettingsState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_partner_settings", {
    p_display_name: formData.get("display_name")?.toString() ?? "",
    p_code: formData.get("code")?.toString() ?? "",
    p_payout_method: formData.get("payout_method")?.toString() ?? "",
    p_payout_phone: formData.get("payout_phone")?.toString() ?? "",
  });
  if (error) {
    if (error.code !== "P0001") console.error("updatePartnerSettings — erreur Supabase:", error);
    return { error: error.code === "P0001" ? error.message : "Impossible d'enregistrer. Réessaie." };
  }
  revalidatePath("/partenaire", "layout");
  return { success: "Réglages enregistrés." };
}
