"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ReplyFormState = {
  error?: string;
  success?: boolean;
};

/**
 * Réponse vendeur aux avis — tâche #78 du 21/09/2026, voir migration 0028
 * (`reply_to_product_review`) pour la doc complète du choix technique.
 * Cette action ne fait que relayer vers la fonction security definer, qui
 * vérifie elle-même la propriété de la boutique — pas de vérification ici
 * au-delà de la présence d'une session, la fonction SQL rejette déjà tout
 * avis qui n'appartient pas au vendeur connecté.
 *
 * `reply` absent ou vide efface la réponse existante (voir reply-form.tsx,
 * le bouton "Supprimer ma réponse" soumet ce même formulaire sans champ
 * `reply`).
 */
export async function replyToReview(
  _prevState: ReplyFormState,
  formData: FormData
): Promise<ReplyFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Session expirée, reconnecte-toi." };
  }

  const reviewId = formData.get("reviewId");
  if (typeof reviewId !== "string" || !reviewId) {
    return { error: "Avis introuvable." };
  }

  const replyRaw = formData.get("reply");
  const reply = typeof replyRaw === "string" ? replyRaw.trim() : "";

  if (reply.length > 500) {
    return { error: "La réponse ne peut pas dépasser 500 caractères." };
  }

  const { error } = await supabase.rpc("reply_to_product_review", {
    p_review_id: reviewId,
    p_reply: reply || null,
  });

  if (error) {
    return { error: "Impossible d'enregistrer la réponse pour le moment." };
  }

  revalidatePath("/dashboard/avis");
  return { success: true };
}
