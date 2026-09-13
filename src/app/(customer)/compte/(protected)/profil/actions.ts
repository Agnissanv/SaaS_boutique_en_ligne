"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CustomerProfileFormState = {
  error?: string;
  success?: boolean;
};

/**
 * Met à jour le nom et le téléphone du compte client connecté — page
 * /compte/profil créée le 15/09/2026, en réponse directe à une limite
 * disclosée le jour même (migration 0014, § comptes client optionnels) :
 * un client dont le téléphone entrait en conflit avec un autre profil à
 * l'inscription n'avait jusqu'ici aucun moyen de le corriger ni de
 * rattacher ses commandes passées en invité.
 *
 * Même logique que updateProfile (vendeur, dashboard/profil/actions.ts),
 * volontairement gardée séparée plutôt que partagée : pas de photo de
 * profil ici (aucun affichage public d'un avatar client nulle part dans
 * l'app, contrairement au vendeur), et les chemins à revalider diffèrent
 * (/compte, pas /dashboard). RLS : `profiles_update_own` (0001_init.sql)
 * ne distingue pas les rôles — déjà valable pour un profil `customer` sans
 * aucune nouvelle policy.
 */
export async function updateCustomerProfile(
  _prevState: CustomerProfileFormState,
  formData: FormData
): Promise<CustomerProfileFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Session expirée, reconnecte-toi." };
  }

  const displayName = String(formData.get("displayName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!displayName || displayName.length < 2) {
    return { error: "Le nom est trop court." };
  }
  if (displayName.length > 60) {
    return { error: "Le nom dépasse 60 caractères." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      // `phone` est unique sur toute la plateforme (0001_init.sql) : chaîne
      // vide -> null pour ne jamais entrer en conflit avec un autre compte
      // (vendeur ou client) qui laisserait aussi ce champ vide.
      phone: phone || null,
    })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") {
      return { error: "Ce numéro de téléphone est déjà utilisé par un autre compte." };
    }
    return { error: "Échec de la mise à jour. Réessaie." };
  }

  revalidatePath("/compte/profil");
  revalidatePath("/compte");
  return { success: true };
}
