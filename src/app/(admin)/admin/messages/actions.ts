"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Même garde-fou que /admin/vendeurs/actions.ts — RLS l'impose déjà côté
 * base (`contact_messages_admin_update`), double-vérifié ici pour ne pas
 * dépendre uniquement de ça. */
async function requireAdmin() {
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

  return profile?.role === "admin" ? { supabase, userId: user.id } : null;
}

/** Marque un message "Nous contacter" comme traité, ou le rouvre (utile si
 * marqué par erreur, ou si le client relance sur le même sujet). */
export async function setContactMessageStatus(messageId: string, status: "new" | "handled") {
  const admin = await requireAdmin();
  if (!admin) return;
  const { supabase, userId } = admin;

  await supabase
    .from("contact_messages")
    .update({
      status,
      handled_at: status === "handled" ? new Date().toISOString() : null,
      handled_by: status === "handled" ? userId : null,
    })
    .eq("id", messageId);

  revalidatePath("/admin/messages");
}
