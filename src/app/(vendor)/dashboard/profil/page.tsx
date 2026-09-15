import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { EmailForm } from "@/components/account-email-form";
import { PasswordForm } from "@/components/account-password-form";

/**
 * Page profil vendeur — créée le 15/09/2026, identifiée comme un manque
 * majeur du dashboard (aucune page profil n'existait, alors que le cahier
 * des charges §3.1.A.1 mentionne "nom d'affichage et une photo de profil"
 * dès l'inscription, jamais modifiables ensuite).
 *
 * Regroupe : identité (nom, téléphone, photo), email de connexion, mot de
 * passe — trois formulaires séparés car ils touchent des systèmes différents
 * (table `profiles` vs `auth.users` vs authentification), chacun avec son
 * propre état de succès/erreur indépendant.
 */
export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, phone, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Mon profil</h1>
      <p className="mt-2 text-sm text-encre/70">
        Gère tes informations personnelles et ta connexion.
      </p>

      <section className="mt-6 max-w-md">
        <h2 className="font-display text-sm font-semibold text-encre">Identité</h2>
        <ProfileForm
          profile={{
            displayName: profile?.display_name ?? "",
            phone: profile?.phone ?? "",
            avatarUrl: profile?.avatar_url ?? null,
          }}
        />
      </section>

      <section className="mt-8 max-w-md border-t border-ligne pt-6">
        <h2 className="font-display text-sm font-semibold text-encre">Email de connexion</h2>
        <EmailForm currentEmail={user.email ?? ""} />
      </section>

      <section className="mt-8 max-w-md border-t border-ligne pt-6">
        <h2 className="font-display text-sm font-semibold text-encre">Mot de passe</h2>
        <PasswordForm />
      </section>
    </div>
  );
}
