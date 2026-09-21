import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { AdminNav } from "./admin-nav";
import { AdminMobileNav } from "./admin-mobile-nav";

/**
 * Layout admin — protège /admin/* et vérifie le rôle 'admin' sur le profil.
 * cf. cahier des charges §3.1.C (dashboard global, gestion vendeurs,
 * gestion abonnements, logs transactions, support basique).
 *
 * **Nav mobile refaite en tiroir le 21/09/2026** : Isaac, après le tiroir du
 * dashboard vendeur, a signalé que l'admin n'avait pas eu le même traitement
 * ("vraiment dégueulasse" sur mobile). Cause : `<AdminNav>` était une barre
 * `flex flex-wrap` avec logo + 4 liens + déconnexion sur la même ligne, qui
 * retombait en plusieurs lignes désordonnées dès que ça ne tenait plus.
 * Sous `sm`, `<AdminNav>` est maintenant masquée (voir ce fichier) et
 * remplacée par `<AdminMobileNav>` (bouton hamburger + tiroir, même schéma
 * que `<MobileNavDrawer>` côté vendeur) ; le bouton de déconnexion inline
 * est lui aussi masqué sous `sm` et déplacé dans le pied du tiroir. Aucun
 * changement visuel au-dessus de `sm` (desktop identique à avant).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/connexion");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-brume">
      <nav className="mb-6 flex items-center gap-3 bg-vert-profond px-4 py-3 text-sm text-ivoire sm:gap-4 sm:px-6">
        <div className="sm:hidden">
          <AdminMobileNav
            footer={
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex w-full items-center rounded-md px-3 py-2.5 text-left text-ivoire/80 hover:bg-white/10 hover:text-ivoire"
                >
                  Déconnexion
                </button>
              </form>
            }
          />
        </div>

        <span className="flex shrink-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo statique */}
          <img src="/keva-logo.jpg" alt="KEVA" className="h-7 w-7 rounded object-cover" />
          <span className="font-display font-semibold tracking-tight">KEVA Admin</span>
        </span>

        <AdminNav />

        <form action={signOut} className="ml-auto hidden sm:block">
          <button type="submit" className="text-ivoire/70 underline hover:text-cuivre-clair">
            Déconnexion
          </button>
        </form>
      </nav>
      <div className="p-6 pt-0">{children}</div>
    </div>
  );
}
