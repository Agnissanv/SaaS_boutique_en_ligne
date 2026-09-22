"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CURRENT_SELLER_CHARTER_VERSION } from "@/lib/seller-charter";

/**
 * Enregistre l'acceptation de la charte vendeur pour le compte connecté.
 * Pas de vérification de rôle ici : n'importe quel compte authentifié peut
 * accepter SA PROPRE charte (même logique que `profiles_update_own`) — le
 * blocage d'accès au dashboard tant que ce n'est pas fait vit dans
 * `dashboard/layout.tsx`, pas ici.
 */
export async function acceptSellerCharter() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/connexion");

  await supabase
    .from("profiles")
    .update({
      shop_charter_accepted_at: new Date().toISOString(),
      shop_charter_version: CURRENT_SELLER_CHARTER_VERSION,
    })
    .eq("id", user.id);

  redirect("/dashboard");
}
