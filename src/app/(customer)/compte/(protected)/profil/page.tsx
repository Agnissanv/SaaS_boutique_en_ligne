import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IdentityForm } from "./identity-form";
import { EmailForm } from "@/components/account-email-form";
import { PasswordForm } from "@/components/account-password-form";

/**
 * Page profil client — créée le 15/09/2026, juste après les comptes client
 * optionnels (migration 0014), pour combler le manque disclosé le jour même
 * dans decisions-techniques.md : un client ne pouvait pas encore corriger
 * son nom/téléphone après l'inscription. Structure identique à la page
 * profil vendeur (dashboard/profil), mêmes composants d'email/mot de passe
 * (partagés, voir src/components/account-*-form.tsx — déjà recolorés en
 * charte KEVA via l'effet de bord du 15/09/2026), sans la photo de profil
 * (pas d'avatar client affiché nulle part dans l'app).
 *
 * Recolorée en charte KEVA le 15/09/2026 (côté client).
 */
export default async function CompteProfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/compte/connexion");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, phone")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Mon profil</h1>
      <p className="mt-2 text-sm text-encre/70">
        Gère tes informations personnelles et ta connexion.
      </p>

      <section className="mt-6 max-w-md">
        <h2 className="text-sm font-medium text-encre">Identité</h2>
        <IdentityForm
          profile={{
            displayName: profile?.display_name ?? "",
            phone: profile?.phone ?? "",
          }}
        />
      </section>

      <section className="mt-8 max-w-md border-t border-ligne pt-6">
        <h2 className="text-sm font-medium text-encre">Email de connexion</h2>
        <EmailForm currentEmail={user.email ?? ""} />
      </section>

      <section className="mt-8 max-w-md border-t border-ligne pt-6">
        <h2 className="text-sm font-medium text-encre">Mot de passe</h2>
        <PasswordForm />
      </section>
    </div>
  );
}
