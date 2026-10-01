"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export type SendNotificationFormState = {
  error?: string;
  success?: string;
};

/** Même garde-fou que /admin/messages/actions.ts — retourne l'id de l'admin
 * (nécessaire pour `sent_by` dans `admin_notification_campaigns`) plutôt
 * qu'un simple booléen. */
async function requireAdmin(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return profile?.role === "admin" ? user.id : null;
}

/**
 * Envoie un message ("admin_message") à une ou plusieurs boutiques — UI
 * manquante notée dans lib/notifications.ts depuis le 21/09/2026 ("aucune UI
 * pour qu'un admin en envoie un pour l'instant"), demandée explicitement par
 * Isaac le 01/10/2026 : rappels, infos de parrainage, annonce de
 * fonctionnalité, piqûre de rappel sur une fonctionnalité sous-utilisée...
 *
 * Un simple insert dans `notifications` (une ligne par boutique ciblée)
 * suffit : le trigger `pg_net` de la migration 0052 se charge tout seul
 * d'envoyer la notification push pour CHAQUE ligne insérée, donc une boutique
 * la reçoit même si elle n'est pas sur KEVA au moment de l'envoi — aucun
 * appel supplémentaire nécessaire ici.
 *
 * `createServiceRoleClient()` obligatoire pour l'écriture (pas le client lié
 * à la session admin) : `notifications` n'a AUCUNE policy RLS d'insert, même
 * pas pour son propre profil (voir 0001_init.sql — "chacun lit/modifie SES
 * propres notifications", jamais n'en crée) ; seules les fonctions `security
 * definer` et le service role peuvent y écrire. Le rôle admin est vérifié
 * juste avant, avec le client normal lié à la session.
 */
export async function sendAdminNotification(
  _prevState: SendNotificationFormState,
  formData: FormData
): Promise<SendNotificationFormState> {
  const adminId = await requireAdmin();
  if (!adminId) return { error: "Accès refusé." };

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const link = String(formData.get("link") ?? "").trim();
  const target = String(formData.get("target") ?? "").trim();

  if (!title) return { error: "Le titre est obligatoire." };
  if (title.length > 120) return { error: "Le titre est trop long (120 caractères max)." };
  if (body.length > 500) return { error: "Le message est trop long (500 caractères max)." };
  if (link && !link.startsWith("/")) {
    return { error: "Le lien doit être un chemin interne à KEVA (ex : /dashboard/parrainage)." };
  }
  if (!target) return { error: "Choisis un destinataire." };

  const service = createServiceRoleClient();
  let ownerIds: string[] = [];
  // Figé au moment de l'envoi pour `admin_notification_campaigns.target_label`
  // (voir migration 0053) : un nom de boutique peut changer après coup,
  // l'historique doit rester lisible tel qu'il était à l'envoi.
  let targetLabel = "";

  if (target === "all") {
    const { data: shops, error } = await service
      .from("shops")
      .select("owner_id")
      .eq("status", "active");
    if (error) return { error: "Impossible de récupérer les boutiques. Réessaie." };
    ownerIds = Array.from(new Set((shops ?? []).map((s) => s.owner_id as string)));
    targetLabel = `Toutes les boutiques actives (${ownerIds.length})`;
  } else {
    const { data: shop, error } = await service
      .from("shops")
      .select("owner_id, name")
      .eq("id", target)
      .maybeSingle();
    if (error || !shop) return { error: "Boutique introuvable." };
    ownerIds = [shop.owner_id as string];
    targetLabel = shop.name as string;
  }

  if (ownerIds.length === 0) {
    return { error: "Aucune boutique active à notifier pour l'instant." };
  }

  const { error: insertError } = await service.from("notifications").insert(
    ownerIds.map((profileId) => ({
      profile_id: profileId,
      title,
      body: body || null,
      link: link || null,
      kind: "admin_message",
    }))
  );

  if (insertError) {
    return { error: "Échec de l'envoi. Réessaie." };
  }

  // Historique côté admin ("qu'est-ce que j'ai envoyé, à qui, quand" —
  // demande d'Isaac du 01/10/2026, voir migration 0053). Best-effort : une
  // erreur ici ne doit jamais faire croire à un échec d'envoi alors que les
  // notifications elles-mêmes sont déjà parties.
  const { error: campaignError } = await service.from("admin_notification_campaigns").insert({
    title,
    body: body || null,
    link: link || null,
    target,
    target_label: targetLabel,
    recipient_count: ownerIds.length,
    sent_by: adminId,
  });
  if (campaignError) {
    console.error("sendAdminNotification: échec d'enregistrement de l'historique", campaignError);
  }

  revalidatePath("/admin/notifications");
  return {
    success: `Message envoyé à ${ownerIds.length} boutique${ownerIds.length > 1 ? "s" : ""}.`,
  };
}
