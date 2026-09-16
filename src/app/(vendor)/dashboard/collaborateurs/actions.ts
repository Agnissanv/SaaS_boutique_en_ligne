"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getShopSubscription } from "@/lib/subscription";
import { sendCollaboratorInviteEmail } from "@/lib/email/collaborator-invite";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InviteFormState = {
  error?: string;
  success?: boolean;
};

/**
 * Gestion des collaborateurs — plan Pro (`can_multi_user`), ajoutée le
 * 16/09/2026 (voir supabase/migrations/0024_shop_collaborators.sql et
 * src/lib/shop-access.ts). Volontairement réservée au PROPRIÉTAIRE : un
 * collaborateur ne peut ni inviter d'autres collaborateurs, ni en retirer —
 * d'où un lookup `owner_id` strict ici, jamais `getAccessibleShop`.
 */
async function getOwnedShop(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data } = await supabase
    .from("shops")
    .select("id, name")
    .eq("owner_id", userId)
    .maybeSingle();
  return data;
}

export async function inviteCollaborator(
  _prevState: InviteFormState,
  formData: FormData
): Promise<InviteFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Session expirée, reconnecte-toi." };
  }

  const shop = await getOwnedShop(supabase, user.id);
  if (!shop) {
    return { error: "Crée d'abord ta boutique." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return { error: "Adresse email invalide." };
  }
  if (email === (user.email ?? "").toLowerCase()) {
    return { error: "Tu ne peux pas t'inviter toi-même." };
  }

  // Revérifié ici côté serveur, même si le formulaire n'est affiché que si
  // le plan le permet côté UI (page.tsx) — même principe que partout ailleurs
  // dans le projet (canManageStock, canCustomizeBranding, etc.).
  const subscription = await getShopSubscription(supabase, shop.id);
  if (!subscription.features.canMultiUser) {
    return { error: "Les collaborateurs sont disponibles à partir du plan Pro." };
  }

  const { count } = await supabase
    .from("shop_collaborators")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shop.id);

  if ((count ?? 0) >= subscription.features.maxCollaborators) {
    return {
      error: `Limite de ${subscription.features.maxCollaborators} collaborateur(s) atteinte pour ton plan ${subscription.planName ?? "actuel"}.`,
    };
  }

  const { error } = await supabase.from("shop_collaborators").insert({
    shop_id: shop.id,
    invited_email: email,
  });

  if (error) {
    // 23505 : contrainte unique (shop_id, invited_email) — déjà invité.
    if (error.code === "23505") {
      return { error: "Cette personne est déjà invitée." };
    }
    console.error("inviteCollaborator — erreur Supabase:", error);
    return { error: "Échec de l'invitation. Réessaie." };
  }

  // Best-effort, ne doit jamais faire échouer l'invitation elle-même (déjà
  // enregistrée en base à ce stade, visible dans la liste même si l'email
  // échoue).
  sendCollaboratorInviteEmail({ email, shopName: shop.name }).catch(() => {});

  revalidatePath("/dashboard/collaborateurs");
  return { success: true };
}

/** Retire un collaborateur (invitation en attente ou déjà active). */
export async function removeCollaborator(collaboratorId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const shop = await getOwnedShop(supabase, user.id);
  if (!shop) return;

  await supabase
    .from("shop_collaborators")
    .delete()
    .eq("id", collaboratorId)
    .eq("shop_id", shop.id);

  revalidatePath("/dashboard/collaborateurs");
}
