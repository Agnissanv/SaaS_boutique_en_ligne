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
 *
 * `?ref=<slug>` (23/09/2026, système de parrainage — voir GoogleAuthButton
 * et supabase/migrations/0045_referral_system.sql) : seul canal disponible
 * pour transmettre un code de parrainage à travers un flux OAuth Google
 * (aucune métadonnée arbitraire possible côté `signUp()` comme pour le
 * formulaire email/mot de passe). Même garde-fou `createdRecently` que pour
 * `portal=customer` juste au-dessus, et pour la même raison : n'écrit
 * `referred_by_code` que pour un compte créé il y a moins d'une minute,
 * jamais pour un vendeur existant qui cliquerait sur un lien de parrainage
 * en étant déjà connecté.
 *
 * `?agent=<code>` (23/09/2026, parrainage COMMERCIAL) : même chemin que
 * `?ref=` juste au-dessus, pour un lien de commercial plutôt qu'un lien de
 * vendeur — écrit dans `referred_by_agent_code`, jamais mélangé avec
 * `referred_by_code`. Voir decisions-techniques.md et
 * supabase/migrations/0046_commercial_referral_system.sql.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const explicitNext = searchParams.get("next");
  const portal = searchParams.get("portal");
  const referralCode = searchParams.get("ref");
  const agentCode = searchParams.get("agent");

  if (code) {
    const supabase = await createClient();
    const {
      error,
      data: { user },
    } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && user) {
      const createdRecently = Date.now() - new Date(user.created_at).getTime() < 60_000;

      if (portal === "customer") {
        const { data: currentProfile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (currentProfile?.role === "vendor" && createdRecently) {
          await supabase.from("profiles").update({ role: "customer" }).eq("id", user.id);
        }
      }

      if (referralCode && createdRecently) {
        await supabase
          .from("profiles")
          .update({ referred_by_code: referralCode })
          .eq("id", user.id)
          .is("referred_by_code", null);
      }

      if (agentCode && createdRecently) {
        await supabase
          .from("profiles")
          .update({ referred_by_agent_code: agentCode })
          .eq("id", user.id)
          .is("referred_by_agent_code", null);
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
