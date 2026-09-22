"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CURRENT_SELLER_CHARTER_VERSION } from "@/lib/seller-charter";

/**
 * Enregistre l'acceptation de la charte vendeur pour le compte connecté.
 * Pas de vérification de rôle ici : n'importe quel compte authentifié peut
 * accepter SA PROPRE charte (même logique que `profiles_update_own`) — le
 * blocage d'accès au dashboard tant que ce n'est pas fait vit dans
 * `dashboard/layout.tsx`, pas ici.
 *
 * **Bug "ça boucle" signalé par Isaac le 22/09/2026, épisode 1** : cette
 * action redirigeait vers /dashboard sans jamais vérifier si l'update avait
 * réussi. En cas d'échec (ex. migration 0040 pas encore appliquée, colonnes
 * manquantes), le layout du dashboard revoyait toujours un compte "non
 * accepté" et renvoyait aussitôt ici — boucle silencieuse et invisible.
 * Corrigé une première fois : on vérifie `error` et on renvoie vers
 * `/charte-vendeur?erreur=1` plutôt que vers /dashboard si l'écriture n'a
 * pas réellement eu lieu.
 *
 * **Épisode 2, toujours le 22/09/2026** : Isaac a continué à voir la boucle
 * MÊME QUAND l'update réussit (confirmé : la page /charte-vendeur affichait
 * bien "Acceptée le 22/09/2026" après coup). Cause réelle : `redirect()`
 * seul ne suffit pas à invalider le cache client du routeur Next
 * (Router Cache) — voir node_modules/next/dist/docs/01-app/02-guides/
 * caching-without-cache-components.md, section "On-demand revalidation",
 * qui montre justement `revalidatePath(...)` AVANT `redirect(...)` après une
 * mutation. Sans ça, si `/dashboard` avait déjà été visité une première fois
 * (et donc mis en cache còté client avec son résultat d'ALORS, un redirect
 * vers /charte-vendeur puisque pas encore accepté), le clic sur "Continuer"
 * — ou même sur le lien "Retour au dashboard" affiché ensuite sur cette
 * page — pouvait resservir cette version périmée du cache plutôt que de
 * revérifier côté serveur, redirigeant donc de nouveau vers ici : la boucle
 * visible par Isaac. Corrigé en invalidant explicitement tout le segment
 * `/dashboard` (et ses sous-routes) juste avant de rediriger dessus.
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

  // Invalide le cache client de tout /dashboard/* : sans ça, une visite
  // précédente (redirigée ici faute d'acceptation) peut rester en cache côté
  // navigateur et renvoyer ici de nouveau au lieu de revérifier le profil
  // fraîchement mis à jour ci-dessus. Voir la note "Épisode 2" ci-dessus.
  revalidatePath("/dashboard", "layout");

  redirect("/dashboard");
}
