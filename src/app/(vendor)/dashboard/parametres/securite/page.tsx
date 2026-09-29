import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleShop } from "@/lib/shop-access";
import { EmailForm } from "@/components/account-email-form";
import { PasswordForm } from "@/components/account-password-form";
import { SettingsTabs } from "../../settings-tabs";

/**
 * Onglet "Sécurité" — ajouté le 30/09/2026 (refonte de l'espace Paramètres,
 * inspiration maquette générique). Reprend tel quel "Email de connexion" et
 * "Mot de passe", qui vivaient jusqu'ici sur `/dashboard/profil` — aucune
 * nouvelle fonctionnalité de sécurité (pas de double authentification, voir
 * decisions-techniques.md pour le choix explicite fait avec Isaac de ne pas
 * en construire une pour cette passe).
 *
 * Accessible à tout utilisateur connecté (propriétaire ou collaborateur),
 * même périmètre que `/dashboard/profil` : c'est le compte de LA PERSONNE
 * connectée, pas un réglage de boutique.
 */
export default async function SecuritySettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion");
  }

  const access = await getAccessibleShop(supabase, user.id);

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Paramètres</h1>
      <p className="mt-2 text-sm text-encre/70">Gère ton profil, ta boutique et ton compte.</p>
      <SettingsTabs isOwner={access?.isOwner ?? false} />

      <section className="mt-6 max-w-md">
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
