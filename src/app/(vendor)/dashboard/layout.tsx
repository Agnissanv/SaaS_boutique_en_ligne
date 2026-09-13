import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { getShopSubscription } from "@/lib/subscription";

/**
 * Layout du dashboard vendeur — protège toutes les routes /dashboard/*.
 * Redirige vers /connexion si non authentifié (page à créer).
 *
 * Affiche aussi une bannière d'abonnement quand il approche/dépasse
 * l'expiration (cf. `src/lib/subscription.ts` et §3.1.A.7 du cahier des
 * charges) — visible sur toutes les pages du dashboard plutôt que seulement
 * l'aperçu, pour que le vendeur ne puisse pas la manquer.
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

  const { data: shop } = await supabase
    .from("shops")
    .select("id, slug")
    .eq("owner_id", user.id)
    .maybeSingle();

  const subscription = shop ? await getShopSubscription(supabase, shop.id) : null;

  return (
    <div className="flex min-h-screen flex-col">
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-200 px-4 py-3 text-sm">
        <Link href="/dashboard">Aperçu</Link>
        <Link href="/dashboard/produits">Produits</Link>
        <Link href="/dashboard/commandes">Commandes</Link>
        <Link href="/dashboard/boutique">Ma boutique</Link>
        <Link href="/dashboard/avis">Avis</Link>
        <Link href="/dashboard/paiements">Paiements</Link>
        <Link href="/dashboard/abonnement">Abonnement</Link>
        <Link href="/dashboard/profil">Profil</Link>
        <Link href="/dashboard/aide">Aide</Link>
        {shop?.slug && (
          <a
            href={`/${shop.slug}`}
            target="_blank"
            rel="noreferrer"
            className="text-gray-500 underline"
          >
            Voir ma boutique ↗
          </a>
        )}
        <form action={signOut} className="ml-auto">
          <button type="submit" className="text-gray-500 underline">
            Déconnexion
          </button>
        </form>
      </nav>

      {subscription?.state === "grace_period" && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Ton abonnement{" "}
          {subscription.planName ? `« ${subscription.planName} »` : ""} a
          expiré le{" "}
          {subscription.expiresAt &&
            new Date(subscription.expiresAt).toLocaleDateString("fr-FR")}
          . Il te reste jusqu&apos;au{" "}
          {subscription.graceEndsAt &&
            new Date(subscription.graceEndsAt).toLocaleDateString("fr-FR")}{" "}
          pour le renouveler avant que l&apos;ajout de nouveaux produits soit
          bloqué. Le paiement automatique n&apos;est pas encore disponible —
          contacte-nous pour renouveler.
        </div>
      )}
      {subscription?.state === "expired" && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          Ton abonnement est expiré : impossible d&apos;ajouter de nouveaux
          produits tant qu&apos;il n&apos;est pas renouvelé. Ta boutique reste
          visible et tu peux toujours gérer tes produits et commandes
          existants. Contacte-nous pour renouveler.
        </div>
      )}

      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
