import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { getShopSubscription } from "@/lib/subscription";
import { getAccessibleShop } from "@/lib/shop-access";
import { SidebarNav } from "./sidebar-nav";

// `ownerOnly` : masqué pour un collaborateur (plan Pro, ajouté le
// 16/09/2026) — mêmes pages que celles filtrées dans sidebar-nav.tsx pour
// la version desktop, voir src/lib/shop-access.ts pour le raisonnement.
const MOBILE_NAV_LINKS = [
  { href: "/dashboard", label: "Aperçu", ownerOnly: false },
  { href: "/dashboard/produits", label: "Produits", ownerOnly: false },
  { href: "/dashboard/commandes", label: "Commandes", ownerOnly: false },
  { href: "/dashboard/boutique", label: "Boutique", ownerOnly: true },
  { href: "/dashboard/avis", label: "Avis", ownerOnly: false },
  { href: "/dashboard/codes-promo", label: "Codes promo", ownerOnly: true },
  { href: "/dashboard/collaborateurs", label: "Collaborateurs", ownerOnly: true },
  { href: "/dashboard/paiements", label: "Paiements", ownerOnly: true },
  { href: "/dashboard/abonnement", label: "Abonnement", ownerOnly: true },
  { href: "/dashboard/profil", label: "Profil", ownerOnly: false },
  { href: "/dashboard/aide", label: "Aide", ownerOnly: false },
];

/**
 * Layout du dashboard vendeur — protège toutes les routes /dashboard/*.
 * Redirige vers /connexion si non authentifié.
 *
 * Refonte du 15/09/2026, à la demande d'Isaac sur inspiration d'une
 * maquette envoyée par son designer UX/UI : navigation en colonne latérale
 * (desktop) plutôt qu'une barre horizontale, plus une barre supérieure avec
 * recherche produit, alerte commandes en attente et identité du vendeur
 * connecté. Deux adaptations délibérées par rapport à la maquette d'origine
 * (confirmées avec Isaac avant de coder) :
 * - Sidebar en vert sapin foncé, pas fond clair comme sur la maquette : le
 *   logo KEVA n'existe qu'en version fond sombre (voir "Identité de marque
 *   KEVA figée"), donc le fond sombre reste nécessaire pour l'utiliser tel
 *   quel plutôt que de fabriquer une variante manquante.
 * - Pas d'icônes de messagerie/notifications factices dans la barre du
 *   haut : la maquette en affiche avec des compteurs, mais rien de tel
 *   n'existe encore côté KEVA (pas de messagerie interne). La seule pastille
 *   affichée (commandes en attente) est branchée sur une vraie donnée
 *   (`orders.status = 'pending'`), jamais un chiffre inventé.
 *
 * Affiche aussi la bannière d'abonnement (cf. `src/lib/subscription.ts` et
 * §3.1.A.7 du cahier des charges) sur toutes les pages du dashboard.
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

  // Résout "sa" boutique : propriétaire, ou collaborateur actif (plan Pro,
  // ajouté le 16/09/2026 — voir src/lib/shop-access.ts pour le raisonnement
  // complet et le périmètre exact des pages accessibles à un collaborateur).
  const [{ data: profile }, access] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle(),
    getAccessibleShop(supabase, user.id),
  ]);

  const { data: shop } = access
    ? await supabase.from("shops").select("id, slug, name").eq("id", access.shopId).maybeSingle()
    : { data: null };
  const isOwner = access?.isOwner ?? true;

  const [subscription, pendingOrdersCount] = await Promise.all([
    shop ? getShopSubscription(supabase, shop.id) : Promise.resolve(null),
    shop
      ? supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("shop_id", shop.id)
          .eq("status", "pending")
          .then(({ count }) => count ?? 0)
      : Promise.resolve(0),
  ]);

  const initial = (profile?.display_name || user.email || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen bg-brume">
      <aside className="hidden w-60 shrink-0 flex-col bg-vert-sapin text-ivoire md:flex">
        <Link href="/dashboard" className="flex items-center gap-2 px-4 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo statique */}
          <img src="/keva-logo.jpg" alt="KEVA" className="h-8 w-8 rounded object-cover" />
          <span className="font-display text-lg font-semibold tracking-tight">KEVA</span>
        </Link>

        <SidebarNav isOwner={isOwner} />

        <div className="border-t border-white/10 px-3 py-3 text-sm">
          {shop?.slug && (
            <a
              href={`/${shop.slug}`}
              target="_blank"
              rel="noreferrer"
              className="block rounded-md px-3 py-2 text-ivoire/70 underline hover:bg-white/5 hover:text-cuivre-clair"
            >
              Voir ma boutique ↗
            </a>
          )}
          <form action={signOut}>
            <button
              type="submit"
              className="block w-full rounded-md px-3 py-2 text-left text-ivoire/70 underline hover:bg-white/5 hover:text-cuivre-clair"
            >
              Déconnexion
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Équivalent mobile de la sidebar (bande horizontale défilante) */}
        <nav className="flex items-center gap-1 overflow-x-auto bg-vert-sapin px-3 py-2 text-sm text-ivoire md:hidden">
          <Link href="/dashboard" className="mr-1 flex shrink-0 items-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo statique */}
            <img src="/keva-logo.jpg" alt="KEVA" className="h-6 w-6 rounded object-cover" />
          </Link>
          {MOBILE_NAV_LINKS.filter((link) => !link.ownerOnly || isOwner).map((link) => (
            <Link key={link.href} href={link.href} className="shrink-0 rounded px-2 py-1 hover:text-cuivre-clair">
              {link.label}
            </Link>
          ))}
          <form action={signOut} className="ml-auto shrink-0">
            <button type="submit" className="text-ivoire/70 underline">
              Déconnexion
            </button>
          </form>
        </nav>

        <header className="flex flex-wrap items-center gap-3 border-b border-ligne bg-white px-4 py-3 sm:gap-4">
          <form
            action="/dashboard/produits"
            method="GET"
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-ligne bg-brume px-3 py-1.5 sm:max-w-sm"
          >
            <IconSearch className="h-4 w-4 shrink-0 text-encre/40" />
            <input
              type="text"
              name="q"
              placeholder="Rechercher un produit..."
              className="w-full bg-transparent text-sm text-encre placeholder:text-encre/40 focus:outline-none"
            />
          </form>

          <Link
            href="/dashboard/commandes"
            title="Commandes en attente"
            className="relative ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ligne text-encre/70 hover:border-cuivre-clair hover:text-cuivre-profond"
          >
            <IconBell className="h-4 w-4" />
            {pendingOrdersCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-erreur px-1 text-[10px] font-medium text-white">
                {pendingOrdersCount}
              </span>
            )}
          </Link>

          <Link href="/dashboard/profil" className="flex shrink-0 items-center gap-2">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- image uploadée par le vendeur
              <img src={profile.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sable text-sm font-medium text-cuivre-profond">
                {initial}
              </span>
            )}
            <span className="hidden text-sm sm:block">
              <span className="block font-medium text-encre">
                {profile?.display_name || "Mon compte"}
              </span>
              {shop?.name && <span className="block text-xs text-encre/60">{shop.name}</span>}
            </span>
          </Link>
        </header>

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

        <div className="flex-1 p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

function IconSearch(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function IconBell(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}
