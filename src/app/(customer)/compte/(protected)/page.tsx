import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { getAccessibleShop } from "@/lib/shop-access";

// Lien "Notifications" corrigé le 21/09/2026 : pointait vers /compte/profil
// (un stub, jamais implémenté) — repointé vers le nouvel espace de
// notification client (/compte/notifications, voir ce dossier), avec un
// badge du nombre de non-lues, même principe que la cloche du dashboard
// vendeur (dashboard/layout.tsx).
export default async function ComptePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Colonne corrigée le 21/09/2026 : `profiles` n'a jamais eu de `full_name`
  // (voir `display_name`, migration 0001) — cette requête échouait
  // silencieusement (`profile` toujours `null`), le nom affiché retombait
  // donc systématiquement sur la partie locale de l'email plutôt que le
  // vrai nom du client.
  const [{ data: profile }, access, unreadNotificationsCount] = await Promise.all([
    supabase.from("profiles").select("display_name, phone").eq("id", user?.id ?? "").single(),
    user ? getAccessibleShop(supabase, user.id) : Promise.resolve(null),
    user
      ? supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("profile_id", user.id)
          .eq("is_read", false)
          .then(({ count }) => count ?? 0)
      : Promise.resolve(0),
  ]);

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Mon compte";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="mx-auto w-full max-w-lg space-y-8">
      {/* ========== EN-TÊTE PROFIL ========== */}
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-vert-sapin text-lg font-semibold text-ivoire">
          {initial}
        </div>
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold text-encre">
            {displayName}
          </p>
          <Link
            href="/compte/profil"
            className="text-sm text-encre/60 hover:text-vert-actif"
          >
            Voir mon profil
          </Link>
        </div>
      </div>

      {/* ========== MES COMMANDES ========== */}
      <section>
        <h2 className="mb-2 font-display text-base font-semibold text-encre">
          Commandes
        </h2>
        <div className="overflow-hidden rounded-xl border border-ligne bg-white">
          <AccountLink href="/compte/commandes" label="Mes commandes" last />
        </div>
      </section>

      {/* ========== MON COMPTE ========== */}
      <section>
        <h2 className="mb-2 font-display text-base font-semibold text-encre">
          Mon compte
        </h2>
        <div className="overflow-hidden rounded-xl border border-ligne bg-white">
          <AccountLink href="/compte/profil" label="Informations personnelles" />
          <AccountLink href="/compte/profil" label="Sécurité & connexion" />
          <AccountLink
            href="/compte/notifications"
            label="Notifications"
            badge={unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined}
            last
          />
        </div>
      </section>

      {/* ========== ESPACE VENDEUR ==========
          Ajouté le 21/09/2026 : un compte peut posséder une boutique tout en
          restant enregistré côté "client" (voir `resolveHomePath`,
          `auth-constants.ts`) — n'affiché que si c'est réellement le cas ici
          (`getAccessibleShop`), jamais une invitation à en créer une. */}
      {access && (
        <section>
          <h2 className="mb-2 font-display text-base font-semibold text-encre">
            Espace vendeur
          </h2>
          <div className="overflow-hidden rounded-xl border border-ligne bg-white">
            <AccountLink href="/dashboard" label="Gérer ma boutique" last />
          </div>
        </section>
      )}

      {/* ========== AIDE ==========
          Liens branchés le 22/09/2026 (étaient des stubs "#") : "Centre
          d'aide" pointe vers la nouvelle FAQ client (voir ./aide/page.tsx).
          "Nous contacter" et "Donner un avis" pointaient d'abord vers un
          mailto:contactkevashop@gmail.com, remplacé le même jour par un vrai
          formulaire in-app (/contact, voir ce dossier) pour ne pas faire
          sortir le client de l'app — "Donner un avis" réutilise cette même
          page avec ?sujet=avis plutôt que de garder un mailto séparé. */}
      <section>
        <h2 className="mb-2 font-display text-base font-semibold text-encre">
          Aide & Support
        </h2>
        <div className="overflow-hidden rounded-xl border border-ligne bg-white">
          <AccountLink href="/compte/aide" label="Centre d’aide" />
          <AccountLink href="/contact" label="Nous contacter" />
          <AccountLink href="/contact?sujet=avis" label="Donner un avis" last />
        </div>
      </section>

      {/* ========== LÉGAL ========== */}
      <section>
        <h2 className="mb-2 font-display text-base font-semibold text-encre">
          Légal
        </h2>
        <div className="overflow-hidden rounded-xl border border-ligne bg-white">
          <AccountLink href="/conditions-utilisation" label="Conditions d’utilisation" />
          <AccountLink href="/politique-confidentialite" label="Politique de confidentialité" last />
        </div>
      </section>

      {/* ========== DÉCONNEXION ========== */}
      <form action={signOut}>
        <button
          type="submit"
          className="w-full rounded-xl border border-ligne bg-white px-4 py-3.5 text-left text-sm font-medium text-erreur transition hover:bg-erreur/5"
        >
          Déconnexion
        </button>
      </form>
    </div>
  );
}

function AccountLink({
  href,
  label,
  badge,
  last = false,
}: {
  href: string;
  label: string;
  badge?: number;
  last?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between px-4 py-3.5 text-sm text-encre transition hover:bg-brume/50 ${
        last ? "" : "border-b border-ligne"
      }`}
    >
      <span className="flex items-center gap-2">
        {label}
        {badge != null && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-erreur px-1 text-[10px] font-medium text-white">
            {badge}
          </span>
        )}
      </span>
      <span className="text-encre/30">›</span>
    </Link>
  );
}