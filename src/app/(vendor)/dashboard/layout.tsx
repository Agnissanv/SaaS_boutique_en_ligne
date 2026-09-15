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
    <div className="flex min-h-screen flex-col bg-brume">
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-vert-sapin px-4 py-3 text-sm text-ivoire">
        <Link href="/dashboard" className="mr-2 flex shrink-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo statique */}
          <img src="/keva-logo.jpg" alt="KEVA" className="h-7 w-7 rounded object-cover" />
          <span className="font-display font-semibold tracking-tight">KEVA</span>
        </Link>
        <Link href="/dashboard" className="hover:text-cuivre-clair">Aperçu</Link>
        <Link href="/dashboard/produits" className="hover:text-cuivre-clair">Produits</Link>
        <Link href="/dashboard/commandes" className="hover:text-cuivre-clair">Commandes</Link>
        <Link href="/dashboard/boutique" className="hover:text-cuivre-clair">Ma boutique</Link>
        <Link href="/dashboard/avis" className="hover:text-cuivre-clair">Avis</Link>
        <Link href="/dashboard/paiements" className="hover:text-cuivre-clair">Paiements</Link>
        <Link href="/dashboard/abonnement" className="hover:text-cuivre-clair">Abonnement</Link>
        <Link href="/dashboard/profil" className="hover:text-cuivre-clair">Profil</Link>
        <Link href="/dashboard/aide" className="hover:text-cuivre-clair">Aide</Link>
        {shop?.slug && (
          <a
            href={`/${shop.slug}`}
            target="_blank"
            rel="noreferrer"
            className="text-ivoire/70 underline hover:text-cuivre-clair"
          >
            Voir ma boutique ↗
          </a>
        )}
        <form action={signOut} className="ml-auto">
          <button type="submit" className="text-ivoire/70 underline hover:text-cuivre-clair">
            Déconnexion
          </button>
        </form>
      </nav>

      {subscription?.state === "grace_period" && (
        <div className="border-b border-attention/30 bg-attention/10 px-4 py-2 text-sm text-attention">
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
        <div className="border-b border-erreur/30 bg-erreur/10 px-4 py-2 text-sm text-erreur">
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
