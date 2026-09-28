import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Limitation de débit pour les points d'entrée publics (sans authentification)
 * — voir migration 0048_public_endpoint_rate_limits.sql pour le détail de la
 * table et de la fonction SQL. Toujours appelé via le client service-role :
 * la table `endpoint_rate_limits` n'a aucune policy RLS, elle n'est donc
 * accessible que depuis ici (ou directement en service-role ailleurs).
 *
 * `identifier` est en pratique l'IP du visiteur (voir `getClientIp` dans ce
 * même fichier) — pas parfait (IP partagée derrière un même routeur/proxy
 * d'entreprise, VPN...), mais suffisant pour décourager un abus simple sans
 * bloquer personne de façon permanente (fenêtre glissante, jamais un ban
 * définitif).
 */
export async function checkRateLimit(
  scope: string,
  identifier: string,
  options: { maxAttempts: number; windowMinutes: number }
): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_scope: scope,
    p_identifier: identifier,
    p_max_attempts: options.maxAttempts,
    p_window_minutes: options.windowMinutes,
  });

  if (error) {
    // Ne bloque jamais l'utilisateur si la vérification elle-même échoue
    // (table absente, RPC en erreur...) : une limitation de débit qui tombe
    // en panne ne doit pas empêcher un visiteur légitime de contacter le
    // support ou de chercher un produit.
    console.error(`checkRateLimit(${scope}) — erreur RPC, requête autorisée par défaut:`, error);
    return true;
  }

  return data === true;
}

/**
 * Récupère l'IP du visiteur depuis les en-têtes transmis par Vercel.
 * `x-forwarded-for` peut contenir plusieurs IP séparées par une virgule
 * (chaîne de proxys) — la première est celle du client d'origine. Repli sur
 * une valeur fixe si l'en-tête est absent (jamais le cas sur Vercel en
 * production, peut arriver en local) : mieux vaut regrouper ce trafic sous
 * un même compteur que de planter la vérification.
 */
export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]!.trim();
  }
  return headers.get("x-real-ip") ?? "unknown";
}
