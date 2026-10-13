import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

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
  // 'commercial' (23/09/2026, parrainage commercial) : ne s'inscrit jamais
  // par ce chemin en pratique (compte créé par un admin, voir
  // decisions-techniques.md) mais ajouté ici par cohérence avec
  // `resolveHomePath` juste en dessous.
  if (role === "commercial") return "/commercial";
  return "/dashboard";
}

/**
 * Version "entitlement-aware" de `roleHomePath`, ajoutée le 21/09/2026 suite
 * à un bug signalé par Isaac : connecté via le portail vendeur (`/connexion`)
 * avec un compte possédant bel et bien une boutique, il atterrissait quand
 * même sur l'espace client (`/compte`).
 *
 * Root cause : `profiles.role` n'est qu'une étiquette figée au moment de
 * l'inscription (quel formulaire a été utilisé en premier), jamais mise à
 * jour ensuite — alors que rien dans les policies RLS ne s'appuie dessus
 * pour l'accès réel. `shops_owner_all` (0001) et `shop_collaborators`
 * (0024) vérifient uniquement `auth.uid()`, jamais `profiles.role` : un
 * compte peut donc déjà posséder une boutique tout en ayant
 * `role = 'customer'` (ex : quelqu'un a testé l'inscription cliente avec son
 * email avant de créer sa boutique depuis /dashboard/boutique, accessible à
 * n'importe quel compte authentifié). Ancien comportement : la redirection
 * ne regardait que l'étiquette figée, jamais la réalité de ce que le compte
 * possède — d'où l'incohérence.
 *
 * Nouvelle règle, dans l'ordre : `admin` d'abord (aucun besoin de vérifier
 * une boutique) ; sinon boutique possédée/co-gérée → `/dashboard` (qu'importe
 * l'étiquette de rôle) ; sinon `role = 'vendor'` → `/dashboard` quand même
 * (onboarding : un vendeur tout juste inscrit n'a pas encore de boutique, les
 * pages du dashboard le renvoient déjà vers /dashboard/boutique pour la
 * créer, cf. `/dashboard/avis` par ex.) ; sinon `/compte`.
 *
 * Utilisée uniquement pour un compte qui se RECONNECTE (mot de passe, lien
 * magique, réinitialisation) — pas à l'inscription (`inscription-form.tsx`
 * garde `roleHomePath`, plus simple : un compte tout juste créé ne peut par
 * construction posséder aucune boutique, la vérification serait toujours
 * négative).
 */
export async function resolveHomePath(
  supabase: SupabaseClient<Database>,
  userId: string,
  role: string | null | undefined,
  // Programme partenaire (13/10/2026) : dernier espace choisi avec le
  // sélecteur « Ma boutique | Partenaire » (cookie `keva_espace`, voir
  // `readSpacePreference`). Une partenaire arrive sur son espace partenaire
  // par défaut, sur sa boutique si c'est le dernier espace qu'elle a ouvert.
  spacePreference?: string | null
): Promise<string> {
  if (role === "admin") return "/admin";
  // 'commercial' (23/09/2026, parrainage commercial, voir
  // decisions-techniques.md) : traité avant la vérification de boutique
  // ci-dessous, un commercial n'en possède jamais une par construction —
  // même raisonnement que 'admin' juste au-dessus.
  if (role === "commercial") return "/commercial";

  const [{ data: owned }, { data: collab }, { data: partner }] = await Promise.all([
    supabase.from("shops").select("id").eq("owner_id", userId).maybeSingle(),
    supabase
      .from("shop_collaborators")
      .select("shop_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle(),
    supabase.from("partners").select("id").eq("profile_id", userId).maybeSingle(),
  ]);

  if (partner) return spacePreference === "boutique" && (owned || collab) ? "/dashboard" : "/partenaire";
  if (owned || collab) return "/dashboard";
  if (role === "vendor") return "/dashboard";
  return "/compte";
}

/** Valeur du cookie `keva_espace` dans un en-tête Cookie (ou `document.cookie`). */
export function readSpacePreference(cookieHeader: string | null | undefined): string | null {
  const match = (cookieHeader ?? "").match(/(?:^|;\s*)keva_espace=([a-z]+)/);
  return match ? match[1] : null;
}
