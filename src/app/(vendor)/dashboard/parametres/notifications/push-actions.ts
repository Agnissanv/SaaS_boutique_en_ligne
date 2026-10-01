"use server";

import { createClient } from "@/lib/supabase/server";

export type PushActionState = {
  error?: string;
  success?: boolean;
};

/**
 * Enregistre un abonnement push pour l'utilisateur connecté — appelée
 * directement depuis `push-toggle.tsx` (pas via un `<form>`, la Server
 * Action est invoquée comme une fonction normale après
 * `pushManager.subscribe()` côté navigateur). Un même `endpoint` (unique en
 * base, voir migration 0052) peut se représenter si le navigateur renouvelle
 * son abonnement : `upsert` plutôt qu'`insert`, pour ne jamais échouer sur un
 * conflit ni dupliquer la ligne.
 */
export async function subscribeToPush(subscription: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<PushActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Session expirée, reconnecte-toi." };
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      profile_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    return { error: "Échec de l'activation. Réessaie." };
  }
  return { success: true };
}

/**
 * Supprime l'abonnement push correspondant à cet appareil/navigateur — la
 * policy RLS "push_subscriptions_owner_all" (migration 0052) garantit déjà
 * qu'on ne peut supprimer qu'un abonnement dont `profile_id = auth.uid()`,
 * donc un `endpoint` volé/deviné d'un autre utilisateur ne supprimerait rien.
 */
export async function unsubscribeFromPush(endpoint: string): Promise<PushActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Session expirée, reconnecte-toi." };
  }

  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);

  if (error) {
    return { error: "Échec de la désactivation. Réessaie." };
  }
  return { success: true };
}
