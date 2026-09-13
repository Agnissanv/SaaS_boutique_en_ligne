import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { roleHomePath } from "@/lib/auth-constants";

/**
 * Point d'arrivée du lien magique envoyé par email (Supabase Auth).
 * Route : /auth/callback?code=...
 *
 * Supabase (flux PKCE, actif par défaut côté navigateur) envoie par défaut
 * un email contenant un LIEN plutôt qu'un simple code à 6 chiffres, même
 * quand on appelle `signInWithOtp`. Sans cette route, cliquer sur ce lien
 * renvoyait vers la page d'accueil avec un `?code=...` jamais consommé —
 * l'utilisateur restait non connecté sans comprendre pourquoi.
 *
 * Avec `emailRedirectTo` pointé ici (voir connexion-form.tsx), le lien
 * atterrit sur cette route, qui échange le code contre une session, puis
 * redirige vers l'espace correspondant au rôle du compte (portail de
 * connexion unique, cf. demande d'Isaac du 13/09/2026 : "un vrai portail...
 * qui reconnaît le rôle de chacun") — pas un `/dashboard` toujours fixe,
 * qui obligeait un admin à taper /admin lui-même après connexion.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const explicitNext = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const {
      error,
      data: { user },
    } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && user) {
      if (explicitNext) {
        return NextResponse.redirect(`${origin}${explicitNext}`);
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const destination = roleHomePath(profile?.role);
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  // Code manquant, expiré, déjà utilisé, ou échangé depuis un autre
  // navigateur que celui qui a demandé la connexion (limite du PKCE).
  return NextResponse.redirect(`${origin}/connexion?erreur=lien_invalide`);
}
