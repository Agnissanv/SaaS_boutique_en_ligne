"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Déconnexion — manquait jusqu'ici (13/09/2026) : aucun bouton, aucune
 * action nulle part dans l'app ne permettait de se déconnecter. Trouvé en
 * vérifiant la sécurité du "portail de connexion" à la demande d'Isaac.
 * Important sur un ordinateur partagé (cybercafé, boutique physique) — un
 * portail qui ne laisse pas se déconnecter n'est pas vraiment sécurisé.
 *
 * `scope: 'global'` (par défaut) révoque le refresh token côté Supabase, pas
 * seulement le cookie local — une vraie déconnexion, pas juste un oubli
 * côté navigateur.
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/connexion");
}
