import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";

export default async function ComptePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user?.id ?? "")
    .single();

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Mon compte";
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
          <AccountLink href="/compte/profil" label="Notifications" last />
        </div>
      </section>

      {/* ========== AIDE ========== */}
      <section>
        <h2 className="mb-2 font-display text-base font-semibold text-encre">
          Aide & Support
        </h2>
        <div className="overflow-hidden rounded-xl border border-ligne bg-white">
          <AccountLink href="#" label="Centre d’aide" />
          <AccountLink href="#" label="Nous contacter" />
          <AccountLink href="#" label="Donner un avis" last />
        </div>
      </section>

      {/* ========== LÉGAL ========== */}
      <section>
        <h2 className="mb-2 font-display text-base font-semibold text-encre">
          Légal
        </h2>
        <div className="overflow-hidden rounded-xl border border-ligne bg-white">
          <AccountLink href="#" label="Conditions d’utilisation" />
          <AccountLink href="#" label="Politique de confidentialité" last />
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
  last = false,
}: {
  href: string;
  label: string;
  last?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between px-4 py-3.5 text-sm text-encre transition hover:bg-brume/50 ${
        last ? "" : "border-b border-ligne"
      }`}
    >
      <span>{label}</span>
      <span className="text-encre/30">›</span>
    </Link>
  );
}