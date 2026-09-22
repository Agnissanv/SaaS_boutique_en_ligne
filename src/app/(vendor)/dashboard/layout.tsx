import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { getShopSubscription } from "@/lib/subscription";
import { getAccessibleShop } from "@/lib/shop-access";
import { CURRENT_SELLER_CHARTER_VERSION } from "@/lib/seller-charter";
import { SidebarNav } from "./sidebar-nav";
import { MobileNavDrawer } from "./mobile-nav-drawer";

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
 *   haut à l'origine : la maquette en affiche avec des compteurs, mais rien
 *   de tel n'existait encore côté KEVA. Corrigé le 21/09/2026 (voir
 *   ci-dessous) : la pastille reste branchée sur une vraie donnée, jamais un
 *   chiffre inventé.
 *
 * Affiche aussi la bannière d'abonnement (cf. `src/lib/subscription.ts` et
 * §3.1.A.7 du cahier des charges) sur toutes les pages du dashboard.
 *
 * **Lien "Mon espace client" ajouté le 21/09/2026** : un vendeur peut aussi
 * acheter sur KEVA avec le même compte (voir `resolveHomePath`,
 * `auth-constants.ts` — l'infrastructure le permettait déjà depuis la
 * migration 0014, il manquait juste un moyen visible d'y aller). Lien
 * inconditionnel (pas besoin de vérifier un historique de commandes : /compte
 * accepte n'importe quel compte connecté, voir son propre layout).
 *
 * **Nav mobile refaite en tiroir le 21/09/2026** : l'ancienne barre
 * horizontale défilante (onze liens à plat, texte tronqué) laisse place à
 * `<MobileNavDrawer>`, qui réutilise `<SidebarNav>` — voir ce fichier pour
 * le détail. Le pied du tiroir (boutique en ligne / espace client /
 * déconnexion) est le même contenu que le pied de la sidebar desktop
 * ci-dessous, juste dupliqué en JSX (pas en logique) pour être passé en
 * prop à un Client Component.
 *
 * **Cloche = notifications, plus seulement commandes en attente (21/09/2026)**
 * — demande d'Isaac : "un espace notification qui concerne seulement les
 * commandes... je veux un vrai espace notification qui concerne tout".
 * `pendingOrdersCount` (requête directe sur orders.status) est remplacé par
 * un comptage de `notifications.is_read = false`, et le lien pointe
 * désormais vers /dashboard/notifications plutôt que /dashboard/commandes.
 * Voir src/lib/notifications.ts et cette route pour le reste du système.
 *
 * **Règles KEVA obligatoires à l'inscription (22/09/2026)** : redirige vers
 * /charte-vendeur tant que `shop_charter_version` du profil est inférieure à
 * `CURRENT_SELLER_CHARTER_VERSION` (ou jamais acceptée). S'applique à tout
 * compte qui atteint le dashboard, propriétaire ou collaborateur — voir
 * src/lib/seller-charter.ts et supabase/migrations/0040_*.sql. Vérifié ici,
 * pas dans un middleware : cohérent avec le reste du contrôle d'accès du
 * dashboard (déjà entièrement fait dans ce layout).
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
    supabase
      .from("profiles")
      .select("display_name, avatar_url, shop_charter_accepted_at, shop_charter_version")
      .eq("id", user.id)
      .maybeSingle(),
    getAccessibleShop(supabase, user.id),
  ]);

  const charterAccepted =
    !!profile?.shop_charter_accepted_at &&
    (profile.shop_charter_version ?? 0) >= CURRENT_SELLER_CHARTER_VERSION;
  if (!charterAccepted) {
    redirect("/charte-vendeur");
  }

  // `status` ajouté à la sélection le 22/09/2026 (audit pré-lancement) : ce
  // layout ne vérifiait jamais si la boutique était suspendue — un vendeur
  // suspendu par l'admin n'avait donc aucun signal dans son propre dashboard
  // (voir la bannière ci-dessous). La suspension bloque déjà la boutique
  // publique et les nouvelles commandes ; la question de bloquer aussi les
  // actions du dashboard lui-même reste un choix produit à trancher avec
  // Isaac, pas encore fait ici.
  const { data: shop } = access
    ? await supabase.from("shops").select("id, slug, name, status").eq("id", access.shopId).maybeSingle()
    : { data: null };
  const isOwner = access?.isOwner ?? true;

  const [subscription, unreadNotificationsCount] = await Promise.all([
    shop ? getShopSubscription(supabase, shop.id) : Promise.resolve(null),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id)
      .eq("is_read", false)
      .then(({ count }) => count ?? 0),
  ]);

  const initial = (profile?.display_name || user.email || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen bg-brume">
      <aside className="hidden w-60 shrink-0 flex-col bg-vert-sapin text-ivoire md:flex">
        <Link href="/dashboard" className="flex items-center gap-2 px-4 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo statique */}
          <img src="/keva-logo.jpg" alt="KEVA" className="h-8 w-8 rounded object-cover" />
          <span className="font-display text-lg font-bold tracking-wide">KEVA</span>
        </Link>

        <SidebarNav isOwner={isOwner} />

        <div className="border-t border-white/10 px-3 py-3 text-sm">
          {shop?.slug && (
            <a
              href={`/${shop.slug}`}
              target="_blank"
              rel="noreferrer"
              className="block rounded-md px-3 py-2 text-ivoire/70 underline hover:bg-white/5 hover:text-ivoire"
            >
              Voir ma boutique ↗
            </a>
          )}
          <Link
            href="/compte"
            className="block rounded-md px-3 py-2 text-ivoire/70 underline hover:bg-white/5 hover:text-ivoire"
          >
            Mon espace client
          </Link>
          <Link
            href="/charte-vendeur"
            className="block rounded-md px-3 py-2 text-ivoire/70 underline hover:bg-white/5 hover:text-ivoire"
          >
            Règles de KEVA
          </Link>
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
        {/* Équivalent mobile de la sidebar : tiroir de navigation, voir
            mobile-nav-drawer.tsx et la note du 21/09/2026 ci-dessus. */}
        <div className="flex items-center gap-2 bg-vert-sapin px-3 py-2 text-ivoire md:hidden">
          <MobileNavDrawer
            isOwner={isOwner}
            footer={
              <>
                {shop?.slug && (
                  <a
                    href={`/${shop.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-md px-3 py-2 text-ivoire/70 underline hover:bg-white/5 hover:text-ivoire"
                  >
                    Voir ma boutique ↗
                  </a>
                )}
                <Link
                  href="/compte"
                  className="block rounded-md px-3 py-2 text-ivoire/70 underline hover:bg-white/5 hover:text-ivoire"
                >
                  Mon espace client
                </Link>
                <Link
                  href="/charte-vendeur"
                  className="block rounded-md px-3 py-2 text-ivoire/70 underline hover:bg-white/5 hover:text-ivoire"
                >
                  Règles de KEVA
                </Link>
                <form action={signOut}>
                  <button
                    type="submit"
                    className="block w-full rounded-md px-3 py-2 text-left text-ivoire/70 underline hover:bg-white/5 hover:text-ivoire"
                  >
                    Déconnexion
                  </button>
                </form>
              </>
            }
          />
          <Link href="/dashboard" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo statique */}
            <img src="/keva-logo.jpg" alt="KEVA" className="h-7 w-7 rounded object-cover" />
            <span className="font-display text-base font-bold tracking-wide">KEVA</span>
          </Link>
        </div>

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
            href="/dashboard/notifications"
            title="Notifications"
            className="relative ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ligne text-encre/70 hover:border-vert-actif hover:text-vert-actif"
          >
            <IconBell className="h-4 w-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-erreur px-1 text-[10px] font-medium text-white">
                {unreadNotificationsCount}
              </span>
            )}
          </Link>

          <Link href="/dashboard/profil" className="flex shrink-0 items-center gap-2">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- image uploadée par le vendeur
              <img src={profile.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brume text-sm font-medium text-vert-actif">
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

        {/* Bannière ajoutée le 22/09/2026 (audit pré-lancement) : cf. note sur
            `shop.status` ci-dessus — un vendeur suspendu n'avait jusqu'ici
            aucun indice dans son propre dashboard. */}
        {shop?.status === "suspended" && (
          <div className="border-b border-erreur/30 bg-erreur/10 px-4 py-2 text-sm text-erreur">
            Ta boutique a été suspendue par l&apos;équipe KEVA : elle
            n&apos;est plus visible sur la marketplace et ne peut plus
            recevoir de nouvelles commandes. Contacte-nous pour en savoir
            plus.
          </div>
        )}
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
