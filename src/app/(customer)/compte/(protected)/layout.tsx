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
 *
 * Recolorée en charte KEVA le 15/09/2026 (côté client) — même traitement de
 * nav que les autres espaces (fond vert profond, logo, liens ivoire).
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
    <div className="min-h-screen bg-brume">
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-vert-profond px-4 py-3 text-sm text-ivoire">
        <span className="mr-2 flex shrink-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo statique */}
          <img src="/keva-logo.jpg" alt="KEVA" className="h-7 w-7 rounded object-cover" />
          <span className="font-display font-semibold tracking-tight">Mon compte</span>
        </span>
        <Link href="/compte" className="font-medium text-ivoire hover:text-cuivre-clair">
          Mes commandes
        </Link>
        <Link href="/compte/profil" className="text-ivoire/70 underline hover:text-cuivre-clair">
          Mon profil
        </Link>
        <Link href="/" className="text-ivoire/70 underline hover:text-cuivre-clair">
          Retour à la marketplace
        </Link>
        <form action={signOut} className="ml-auto">
          <button type="submit" className="text-ivoire/70 underline hover:text-cuivre-clair">
            Déconnexion
          </button>
        </form>
      </nav>
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
