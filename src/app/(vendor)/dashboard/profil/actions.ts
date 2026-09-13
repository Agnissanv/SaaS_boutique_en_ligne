"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ProfileFormState = {
  error?: string;
  success?: boolean;
};

/**
 * Met à jour le profil du vendeur connecté (nom d'affichage, téléphone,
 * photo de profil) — page /dashboard/profil créée le 15/09/2026, jusqu'ici
 * ces informations n'étaient renseignables qu'à l'inscription (trigger
 * handle_new_user, 0002/0009) et jamais modifiables ensuite.
 *
 * RLS : `profiles_update_own` (0001_init.sql) autorise déjà chaque
 * utilisateur à modifier sa propre ligne, et le trigger
 * `profiles_prevent_role_escalation` (0008) bloque tout changement de
 * `role` — cette action ne touche de toute façon jamais cette colonne, mais
 * la protection existe même en cas de bidouillage côté client.
 */
export async function updateProfile(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Session expirée, reconnecte-toi." };
  }

  const displayName = String(formData.get("displayName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  // Renseignée côté client après upload direct vers Supabase Storage (voir
  // storage.ts, comme pour le logo/la couverture boutique) — chaîne vide si
  // le vendeur n'a pas (encore) choisi de photo.
  const avatarUrl = String(formData.get("avatarUrl") ?? "").trim();

  if (!displayName || displayName.length < 2) {
    return { error: "Le nom d'affichage est trop court." };
  }
  if (displayName.length > 60) {
    return { error: "Le nom d'affichage dépasse 60 caractères." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      // `phone` est unique (0001_init.sql) : chaîne vide -> null pour ne
      // jamais entrer en conflit avec un autre vendeur qui laisserait aussi
      // ce champ vide.
      phone: phone || null,
      avatar_url: avatarUrl || null,
    })
    .eq("id", user.id);

  if (error) {
    // Cas réel : deux vendeurs tentent le même numéro de téléphone.
    if (error.code === "23505") {
      return { error: "Ce numéro de téléphone est déjà utilisé par un autre compte." };
    }
    return { error: "Échec de la mise à jour. Réessaie." };
  }

  revalidatePath("/dashboard/profil");
  revalidatePath("/dashboard");
  return { success: true };
}
