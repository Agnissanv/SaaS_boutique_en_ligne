import Link from "next/link";
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
 * **Passé en sidebar le 22/09/2026** : la barre horizontale (héritée du
 * premier passage visuel, 15/09/2026, déjà repassée en tiroir sur mobile le
 * 21/09/2026) devenait ingérable une fois montée à 8 liens — demande
 * explicite d'Isaac de "changer de disposition" pour rejoindre le schéma du
 * dashboard vendeur (`DashboardLayout`, `SidebarNav`/`MobileNavDrawer`,
 * 15/09/2026), plutôt que d'inventer un second langage de navigation dans la
 * même appli. Structure copiée à l'identique de ce layout (flex ligne,
 * `<aside>` fixe en `md:flex`, tiroir en dessous) : mêmes classes
 * (`w-60`, `bg-vert-sapin`, pied de sidebar en `border-t border-white/10`),
 * seul le contenu change (logo + `<AdminNav>` maintenant vertical au lieu de
 * `<SidebarNav>`, pied avec juste Déconnexion — pas de lien boutique/espace
 * client, propres au vendeur). `<AdminMobileNav>` n'a pas eu besoin de
 * changer : son tiroir affichait déjà `NAV_ITEMS` verticalement depuis le
 * 21/09/2026, seul son bouton déclencheur change de place (barre supérieure
 * mobile, comme côté vendeur, au lieu de la barre du haut qui disparaît).
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
    <div className="flex min-h-screen bg-brume">
      <aside className="hidden w-60 shrink-0 flex-col bg-vert-sapin text-ivoire md:flex">
        <Link href="/admin" className="flex items-center gap-2 px-4 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo statique */}
          <img src="/keva-logo.jpg" alt="KEVA" className="h-8 w-8 rounded object-cover" />
          <span className="font-display text-lg font-bold tracking-wide">KEVA Admin</span>
        </Link>

        <AdminNav />

        <div className="border-t border-white/10 px-3 py-3 text-sm">
          <form action={signOut}>
            <button
              type="submit"
              className="block w-full rounded-md px-3 py-2 text-left text-ivoire/70 underline hover:bg-white/5 hover:text-ivoire"
            >
              Déconnexion
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 bg-vert-sapin px-3 py-2 text-ivoire md:hidden">
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
          <Link href="/admin" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo statique */}
            <img src="/keva-logo.jpg" alt="KEVA" className="h-7 w-7 rounded object-cover" />
            <span className="font-display text-base font-bold tracking-wide">KEVA Admin</span>
          </Link>
        </div>

        <div className="flex-1 p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
