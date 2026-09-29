import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleShop } from "@/lib/shop-access";
import { ProfileForm } from "./profile-form";
import { SettingsTabs } from "../settings-tabs";

/**
 * Page profil vendeur — créée le 15/09/2026, identifiée comme un manque
 * majeur du dashboard (aucune page profil n'existait, alors que le cahier
 * des charges §3.1.A.1 mentionne "nom d'affichage et une photo de profil"
 * dès l'inscription, jamais modifiables ensuite).
 *
 * **30/09/2026** : "Email de connexion" et "Mot de passe" déménagent dans un
 * nouvel onglet "Sécurité" (`/dashboard/parametres/securite`) — refonte de
 * l'espace Paramètres inspirée d'une maquette générique qu'Isaac a envoyée.
 * Cette page ne garde que l'identité (nom, téléphone, photo), accessible à
 * tout utilisateur connecté (propriétaire ou collaborateur) — d'où le calcul
 * de `isOwner` ci-dessous, seulement pour savoir quels autres onglets
 * afficher dans `SettingsTabs`, pas pour restreindre cette page elle-même.
 */
export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion");
  }

  const [{ data: profile }, access] = await Promise.all([
    supabase.from("profiles").select("display_name, phone, avatar_url").eq("id", user.id).maybeSingle(),
    getAccessibleShop(supabase, user.id),
  ]);

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Paramètres</h1>
      <p className="mt-2 text-sm text-encre/70">Gère ton profil, ta boutique et ton compte.</p>
      <SettingsTabs isOwner={access?.isOwner ?? false} />

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
    </div>
  );
}
