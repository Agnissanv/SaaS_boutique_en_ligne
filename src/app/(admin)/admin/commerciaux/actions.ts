"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils/slug";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return profile?.role === "admin" ? { supabase, userId: user.id } : null;
}

/**
 * Génère un mot de passe temporaire à afficher UNE SEULE FOIS à l'admin
 * (jamais stocké en clair, jamais renvoyé après ce premier affichage) — 12
 * caractères base64url, largement assez d'entropie pour un mot de passe
 * relayé une fois par WhatsApp/SMS et changé au premier besoin par le
 * commercial lui-même (via "mot de passe oublié" sur /connexion, comme
 * n'importe quel autre compte).
 */
function generateTempPassword(): string {
  return randomBytes(9).toString("base64url");
}

export type CreateCommercialState = {
  error?: string;
  success?: {
    name: string;
    email: string;
    code: string;
    password: string;
  };
};

/**
 * Création d'un compte commercial (23/09/2026, parrainage commercial — voir
 * decisions-techniques.md et supabase/migrations/0046_commercial_referral_system.sql).
 *
 * Décision tranchée avec Isaac (AskUserQuestion) : chaque commercial a son
 * propre compte (comme un vendeur), mais AUCUNE auto-inscription publique —
 * seul un admin peut en créer un, exactement comme il embauche quelqu'un
 * dans la vraie vie. D'où `auth.admin.createUser()` (service role,
 * `email_confirm: true` — connexion immédiate, pas d'email de confirmation
 * à attendre) plutôt qu'un `signUp()` classique : le rôle 'commercial'
 * n'est délibérément PAS dans la liste blanche de `handle_new_user()`
 * (migration 0046, même prudence anti-élévation de privilège que 'admin'
 * depuis la migration 0008) — il ne peut être posé qu'ici, après coup, par
 * une action déjà vérifiée admin.
 *
 * `commercial_code` généré à partir du nom (même fonction `slugify` que les
 * slugs de boutique) avec la même boucle anti-collision qu'un slug de
 * boutique (`saveShop`, dashboard/boutique/actions.ts) — cohérent avec le
 * reste du projet plutôt que d'inventer un second générateur de code.
 *
 * Le mot de passe généré n'est renvoyé qu'une fois, dans le résultat de
 * cette action (affiché par CreateCommercialForm) — jamais stocké en clair
 * ni consultable à nouveau ensuite. Isaac le relaie lui-même au commercial
 * (WhatsApp, SMS...) — cohérent avec "c'est un truc que je gère".
 */
export async function createCommercial(
  _prevState: CreateCommercialState,
  formData: FormData
): Promise<CreateCommercialState> {
  const admin = await requireAdmin();
  if (!admin) return { error: "Accès refusé." };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (name.length < 2) {
    return { error: "Le nom est trop court." };
  }
  if (!email || !email.includes("@")) {
    return { error: "Adresse email invalide." };
  }

  const serviceClient = createServiceRoleClient();

  // Code de suivi unique — même boucle anti-collision que le slug de
  // boutique (saveShop) : jusqu'à 5 tentatives avec un suffixe numérique.
  const baseCode = slugify(name) || "commercial";
  let code = baseCode;
  let attempt = 0;
  while (attempt < 5) {
    const { data: existing } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("commercial_code", code)
      .maybeSingle();
    if (!existing) break;
    attempt += 1;
    code = `${baseCode}-${attempt + 1}`;
  }

  const password = generateTempPassword();

  const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: name },
  });

  if (createError || !created.user) {
    return {
      error: createError?.message.includes("already been registered")
        ? "Un compte existe déjà avec cette adresse email."
        : "Impossible de créer le compte. Réessaie.",
    };
  }

  // `handle_new_user()` vient d'insérer un profil avec role='vendor' par
  // défaut (le rôle 'commercial' n'est jamais dans sa liste blanche) — on le
  // corrige ici, juste après, avec le code de suivi généré ci-dessus.
  const { error: updateError } = await serviceClient
    .from("profiles")
    .update({ role: "commercial", commercial_code: code, display_name: name })
    .eq("id", created.user.id);

  if (updateError) {
    return { error: "Compte créé mais impossible de finaliser le profil. Contacte le support technique." };
  }

  revalidatePath("/admin/commerciaux");

  return { success: { name, email, code, password } };
}

/**
 * Pointage manuel d'un paiement de commission (23/09/2026) — Isaac paie ses
 * commerciaux lui-même en dehors de l'app (Wave/mobile money), ce bouton ne
 * fait AUCUN virement réel : il marque simplement comme payées toutes les
 * commissions dues pour ce commercial au moment du clic, pour que le total
 * "dû" reparte à zéro sur /admin/commerciaux et sur son propre espace
 * (/commercial).
 */
export async function markCommercialPaid(commercialId: string) {
  const admin = await requireAdmin();
  if (!admin) return;
  const { supabase } = admin;

  await supabase
    .from("commercial_commission_events")
    .update({ paid_at: new Date().toISOString() })
    .eq("commercial_id", commercialId)
    .is("paid_at", null);

  revalidatePath("/admin/commerciaux");
}
