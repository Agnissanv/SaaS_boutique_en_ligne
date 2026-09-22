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
 *
 * **Bug "ça boucle" signalé par Isaac le 22/09/2026** : cette action
 * redirigeait vers /dashboard sans jamais vérifier si l'update avait
 * réussi. En cas d'échec (ex. migration 0040 pas encore appliquée, colonnes
 * manquantes), le layout du dashboard revoyait toujours un compte "non
 * accepté" et renvoyait aussitôt ici — boucle silencieuse et invisible.
 * Corrigé : on vérifie `error` et on renvoie vers `/charte-vendeur?erreur=1`
 * plutôt que vers /dashboard si l'écriture n'a pas réellement eu lieu.
 */
export async function acceptSellerCharter() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/connexion");

  const { error } = await supabase
    .from("profiles")
    .update({
      shop_charter_accepted_at: new Date().toISOString(),
      shop_charter_version: CURRENT_SELLER_CHARTER_VERSION,
    })
    .eq("id", user.id);

  if (error) {
    redirect("/charte-vendeur?erreur=1");
  }

  redirect("/dashboard");
}
