import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveHomePath } from "@/lib/auth-constants";

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
 * redirige vers l'espace correspondant au compte (portail de connexion
 * unique, cf. demande d'Isaac du 13/09/2026 : "un vrai portail... qui
 * reconnaît le rôle de chacun") — pas un `/dashboard` toujours fixe, qui
 * obligeait un admin à taper /admin lui-même après connexion. Depuis le
 * 21/09/2026, `resolveHomePath` regarde aussi ce que le compte possède
 * réellement (boutique), pas seulement `profiles.role` — voir sa doc.
 *
 * Cette même route sert aussi de retour pour "Se connecter avec Google"
 * (GoogleAuthButton, ajouté le 21/09/2026) — le flux OAuth de Supabase
 * échange lui aussi un `?code=` ici, exactement comme un lien magique.
 *
 * `?portal=customer` (ajouté par GoogleAuthButton uniquement sur le portail
 * client) corrige un problème propre à Google : ses métadonnées OAuth ne
 * contiennent aucun rôle, donc `handle_new_user()` (migration 0030) assigne
 * 'vendor' par défaut à tout compte OAuth tout juste créé (whitelist
 * anti-élévation de privilèges de la migration 0008 — seul un signUp()
 * classique peut transmettre `role: 'customer'` explicitement). On corrige
 * donc ici, mais UNIQUEMENT pour un compte créé il y a moins d'une minute
 * (`user.created_at` très récent) : ça isole le cas "compte tout juste créé
 * depuis /compte/connexion ou /compte/inscription" du cas "compte vendeur
 * existant qui cliquerait par erreur sur ce bouton depuis le portail
 * client" — ce dernier ne doit jamais se faire changer de rôle.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const explicitNext = searchParams.get("next");
  const portal = searchParams.get("portal");

  if (code) {
    const supabase = await createClient();
    const {
      error,
      data: { user },
    } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && user) {
      if (portal === "customer") {
        const { data: currentProfile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        const createdRecently = Date.now() - new Date(user.created_at).getTime() < 60_000;
        if (currentProfile?.role === "vendor" && createdRecently) {
          await supabase.from("profiles").update({ role: "customer" }).eq("id", user.id);
        }
      }

      if (explicitNext) {
        return NextResponse.redirect(`${origin}${explicitNext}`);
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const destination = await resolveHomePath(supabase, user.id, profile?.role);
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  // Code manquant, expiré, déjà utilisé, ou échangé depuis un autre
  // navigateur que celui qui a demandé la connexion (limite du PKCE).
  return NextResponse.redirect(`${origin}/connexion?erreur=lien_invalide`);
}
