"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Marque comme lues les notifications listées, pour le vendeur connecté
 * uniquement (`eq("profile_id", user.id)`, en plus de la policy RLS
 * `notifications_owner_update`) — voir `mark-read.tsx` pour le contexte :
 * cette écriture était jusqu'au 22/09/2026 faite directement dans le rendu
 * serveur de `page.tsx`, un bug trouvé lors de l'audit pré-lancement (un
 * simple prefetch du lien de la cloche, présent dans le header de tout le
 * dashboard, suffisait à la déclencher sans que le vendeur n'ouvre jamais la
 * page).
 */
export async function markNotificationsRead(ids: string[]) {
  if (ids.length === 0) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("profile_id", user.id)
    .in("id", ids);

  revalidatePath("/dashboard/notifications");
  // Revalide aussi le layout : le badge de la cloche (nombre de non lues)
  // est calculé dans `layout.tsx`, affiché sur TOUTES les pages du
  // dashboard — sans ça il resterait faux jusqu'à la prochaine navigation
  // qui force un nouveau rendu du layout.
  revalidatePath("/dashboard", "layout");
}
