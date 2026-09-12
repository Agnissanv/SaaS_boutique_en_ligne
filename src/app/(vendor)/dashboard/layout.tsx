import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Layout du dashboard vendeur — protège toutes les routes /dashboard/*.
 * Redirige vers /connexion si non authentifié (page à créer).
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <nav className="flex gap-4 border-b border-gray-200 px-4 py-3 text-sm">
        <Link href="/dashboard">Aperçu</Link>
        <Link href="/dashboard/produits">Produits</Link>
        <Link href="/dashboard/commandes">Commandes</Link>
        <Link href="/dashboard/boutique">Ma boutique</Link>
      </nav>
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
