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
    <div className="p-6">
      <nav className="mb-6 flex flex-wrap items-center gap-4 border-b border-gray-200 pb-3 text-sm">
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} className="text-gray-700 underline">
            {item.label}
          </Link>
        ))}
        <form action={signOut} className="ml-auto">
          <button type="submit" className="text-gray-500 underline">
            Déconnexion
          </button>
        </form>
      </nav>
      {children}
    </div>
  );
}
