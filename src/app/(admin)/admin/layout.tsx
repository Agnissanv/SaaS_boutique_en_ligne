import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";

const NAV_ITEMS = [
  { href: "/admin", label: "Vue d'ensemble" },
  { href: "/admin/vendeurs", label: "Vendeurs" },
  { href: "/admin/abonnements", label: "Abonnements" },
  { href: "/admin/transactions", label: "Transactions" },
];

/**
 * Layout admin — protège /admin/* et vérifie le rôle 'admin' sur le profil.
 * cf. cahier des charges §3.1.C (dashboard global, gestion vendeurs,
 * gestion abonnements, logs transactions, support basique).
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
      <nav className="mb-6 flex flex-wrap items-center gap-4 bg-vert-profond px-6 py-3 text-sm text-ivoire">
        <span className="mr-2 flex shrink-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo statique */}
          <img src="/keva-logo.jpg" alt="KEVA" className="h-7 w-7 rounded object-cover" />
          <span className="font-display font-semibold tracking-tight">KEVA Admin</span>
        </span>
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} className="text-ivoire/80 underline hover:text-cuivre-clair">
            {item.label}
          </Link>
        ))}
        <form action={signOut} className="ml-auto">
          <button type="submit" className="text-ivoire/70 underline hover:text-cuivre-clair">
            Déconnexion
          </button>
        </form>
      </nav>
      <div className="p-6 pt-0">{children}</div>
    </div>
  );
}
