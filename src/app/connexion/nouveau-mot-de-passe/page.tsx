import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NouveauMotDePasseForm } from "./nouveau-mot-de-passe-form";

// Rendu dynamique forcé : cette page dépend de la session de l'utilisateur
// (cookies), donc pas de pré-génération statique possible au build.
export const dynamic = "force-dynamic";

/**
 * Étape finale du flux "mot de passe oublié / pas encore défini"
 * (cf. connexion-form.tsx). On arrive ici uniquement via le lien reçu par
 * email, déjà échangé contre une session par /auth/callback?next=... — donc
 * un utilisateur authentifié est attendu ici. Sans session valide, le lien
 * est périmé ou déjà utilisé : retour à /connexion.
 *
 * Recolorée en charte KEVA le 15/09/2026 (côté client) — même carte/logo que
 * /connexion et /inscription.
 */
export default async function NouveauMotDePassePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion?erreur=lien_invalide");
  }

  return (
    <div className="w-full mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 bg-brume">
      <Link href="/" className="mx-auto mb-6 flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- logo statique */}
        <img src="/keva-logo.jpg" alt="KEVA" className="h-10 w-10 rounded-md object-cover" />
        <span className="font-display text-xl font-bold tracking-wide text-vert-sapin">KEVA</span>
      </Link>
      <div className="rounded-xl border border-ligne bg-white p-6 shadow-sm">
        <h1 className="font-display text-xl font-semibold text-encre">
          Nouveau mot de passe
        </h1>
        <p className="mt-1 text-sm text-encre/70">
          Choisis un mot de passe pour te connecter directement la prochaine
          fois, sans attendre un email.
        </p>
        <NouveauMotDePasseForm />
      </div>
    </div>
  );
}
