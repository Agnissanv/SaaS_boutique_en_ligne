/**
 * Constantes partagées entre les formulaires d'authentification
 * (inscription, nouveau mot de passe) pour éviter que la règle de longueur
 * minimale ne diverge d'un formulaire à l'autre.
 */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Portail de connexion/inscription unique (vendeur/admin) — cf. connexion-form.tsx,
 * inscription-form.tsx et auth/callback/route.ts, qui redirigent tous les
 * trois selon `profiles.role`. Ajouté le 15/09/2026 avec le rôle 'customer'
 * (comptes client optionnels, migration 0014) : sans ce helper, un client qui
 * atterrit par erreur sur le portail vendeur (même Supabase Auth, un seul
 * /connexion pour toute la plateforme) se retrouvait redirigé vers
 * /dashboard, qui l'aurait renvoyé vers la création de boutique — déroutant.
 * Centralisé ici plutôt que dupliqué trois fois pour ne pas risquer de faire
 * diverger la règle entre les trois points d'entrée.
 */
export function roleHomePath(role: string | null | undefined): string {
  if (role === "admin") return "/admin";
  if (role === "customer") return "/compte";
  return "/dashboard";
}
