import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";

/**
 * Layout du compte client — protège /compte/* (sauf /compte/connexion et
 * /compte/inscription, qui vivent hors de ce groupe de layout, voir
 * connexion/page.tsx et inscription/page.tsx dans le même dossier `compte`).
 *
 * Contrairement à /dashboard (réservé au rôle 'vendor') et /admin (réservé à
 * 'admin'), ici n'importe quel compte connecté peut entrer — y compris un
 * vendeur qui commande aussi comme client sur une autre boutique de la
 * plateforme. Ce qui protège les données, c'est `orders.customer_id =
 * auth.uid()` (RLS, migration 0014), pas le rôle du profil.
 */
export default async function CompteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/compte/connexion");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-200 px-4 py-3 text-sm">
        <Link href="/compte" className="font-medium text-gray-900">
          Mes commandes
        </Link>
        <Link href="/compte/profil" className="text-gray-500 underline">
          Mon profil
        </Link>
        <Link href="/" className="text-gray-500 underline">
          Retour à la marketplace
        </Link>
        <form action={signOut} className="ml-auto">
          <button type="submit" className="text-gray-500 underline">
            Déconnexion
          </button>
        </form>
      </nav>
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
