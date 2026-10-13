"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAllCarts } from "@/lib/cart/useShopCart";
import { useWishlist } from "@/lib/wishlist/useWishlist";
import { useLastVisitedShop } from "@/lib/shop/useLastVisitedShop";
import { getBottomNavRoute } from "@/lib/bottom-nav-route";

// Espaces « internes » (13/10/2026 : ne décide plus de l'affichage de la
// barre, voir `getBottomNavRoute` ; reste utilisée par admin-quick-access).
// Racines masquant la barre : portails d'authentification (leur propre
// gabarit carte/logo suffit, pas besoin d'une navigation en plus) et espaces
// internes vendeur/admin (déjà leur propre navigation dédiée, sidebar ou
// barre en pastilles). "favoris" et "compte" ne sont volontairement PAS
// listés ici : ce sont des surfaces client à part entière, la barre y reste
// visible.
//
// Exportée depuis le 01/10/2026 pour `admin-quick-access.tsx` — même liste
// de racines "espace interne, pas besoin de la nav publique" réutilisée là-bas
// pour ne pas proposer "retourner à l'admin" alors qu'on y est déjà.
export const HIDDEN_ROOTS = new Set([
  "connexion",
  "inscription",
  "admin",
  "dashboard",
  "auth",
  "api",
  // Espace partenaire (13/10/2026) : sa propre navigation, comme le
  // tableau de bord vendeur.
  "partenaire",
]);

// "categories" ajouté le 16/09/2026 en même temps que la nouvelle page
// dédiée `/categories` (voir plus bas, `goToCategories` → lien direct) :
// sans cette entrée, `isShopRoute` (calculé plus bas) aurait pris ce premier
// segment pour un slug de boutique — la page catégories aurait alors été
// mémorisée comme "dernière boutique visitée" (useLastVisitedShop) et
// serait ensuite apparue, invalide, dans le lien "Panier" de cette même
// barre. Volontairement PAS dans `HIDDEN_ROOTS` : cette page reste une
// surface client à part entière, la barre y reste visible (même raison que
// "favoris"/"compte" plus haut).

function HomeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M3 9.5 10 3l7 6.5" />
      <path d="M4.5 8.5V16h11V8.5" />
      <path d="M8 16v-4.5h4V16" />
    </svg>
  );
}
function CategoriesIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <rect x="3" y="3" width="6" height="6" rx="1.2" />
      <rect x="11" y="3" width="6" height="6" rx="1.2" />
      <rect x="3" y="11" width="6" height="6" rx="1.2" />
      <rect x="11" y="11" width="6" height="6" rx="1.2" />
    </svg>
  );
}
function CartIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M4 6.5h12l-1 9.5H5L4 6.5Z" />
      <path d="M7 6.5V5a3 3 0 0 1 6 0v1.5" />
    </svg>
  );
}
function HeartIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M10 17s-6.2-3.9-6.2-8.4a3.6 3.6 0 0 1 6.2-2.5 3.6 3.6 0 0 1 6.2 2.5C16.2 13.1 10 17 10 17Z" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="10" cy="6.5" r="3" />
      <path d="M3.5 16.5c1-3.2 3.7-5 6.5-5s5.5 1.8 6.5 5" />
    </svg>
  );
}

const TAB_CLASS = "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px]";

// "Accueil" taguée `nav-back` le 15/09/2026 (chantier "langage natif",
// transitions d'écran, voir decisions-techniques.md) : quel que soit
// l'endroit d'où on tape sur cette tuile (boutique, fiche produit...), on
// revient à la racine de la hiérarchie — même mouvement que le lien "Retour
// à la boutique" de la fiche produit. Les autres onglets (Catégories,
// Panier, Favoris, Compte) restent volontairement sans animation : ce ne
// sont pas des allers-retours sur un même axe, mais des changements de
// rayon, sans direction "avant/arrière" naturelle.

/**
 * Barre de navigation basse, mobile uniquement (`sm:hidden`) — chantier
 * responsive design ouvert le 15/09/2026. Isaac a partagé le modèle Jumia
 * (Accueil/Catégories/Panier/Favoris/Compte fixe en bas d'écran) comme
 * inspiration ; deux écarts délibérés, tranchés avec lui avant de coder
 * (question à choix multiples) :
 *
 * - **"Panier" pointe vers « Mes paniers » (`/paniers`)** depuis le
 *   13/10/2026 — chez nous un panier = une boutique (une commande = une
 *   seule boutique, voir useShopCart.ts) ; la page regroupe tous les paniers
 *   en cours. Avant, l'onglet menait au panier de la dernière boutique
 *   visitée et restait grisé tant qu'aucune n'avait été visitée.
 * - **"Catégories" pointe vers une page dédiée `/categories`** (ajoutée le
 *   16/09/2026, retour d'Isaac : "le bouton catégories doit avoir une page
 *   dédiée bien garnie, comme sur Jumia"). Avant cette date, aucune page de
 *   ce genre n'existait : le bouton scrollait simplement jusqu'à la bande de
 *   catégories de la page d'accueil (`#categories`). Ce lien simple
 *   remplace l'ancien `goToCategories()` (scroll conditionnel + navigation
 *   `router.push`), devenu inutile une fois qu'il y a une vraie page à
 *   toujours ouvrir, quel que soit l'endroit d'où on tape le bouton.
 *
 * Rendue une seule fois, au niveau du layout racine (`layout.tsx`), plutôt
 * que dans chaque page. Où elle s'affiche : voir `getBottomNavRoute`
 * (src/lib/bottom-nav-route.ts, 13/10/2026) — seulement sur les écrans de
 * navigation (accueil, catégories, favoris, compte, vitrine d'une boutique),
 * et elle se cache pendant qu'on fait défiler vers le bas.
 */
export function BottomNav() {
  const pathname = usePathname();
  const route = getBottomNavRoute(pathname);
  const currentShop = route.shopSlug;
  const segments = pathname.split("/").filter(Boolean);
  const isPanier = Boolean(currentShop) && segments[1] === "panier";

  const { setShopSlug } = useLastVisitedShop();

  // Mémorise la boutique courante comme "dernière visitée" dès qu'on est sur
  // une page boutique — synchronisation vers un store externe (localStorage),
  // pas un calcul dérivable au rendu : useEffect est l'outil approprié ici,
  // pas le pattern déjà évité ailleurs dans ce projet (calculer une valeur
  // qui pourrait l'être directement pendant le rendu).
  useEffect(() => {
    if (currentShop) setShopSlug(currentShop);
  }, [currentShop, setShopSlug]);

  // Onglet Panier (13/10/2026) : mène à « Mes paniers », qui regroupe les
  // paniers de toutes les boutiques — il était grisé tant qu'on n'avait
  // visité aucune boutique. Compteur : total des articles de tous les paniers.
  const { totalCount: cartCount } = useAllCarts();
  const { count: favCount } = useWishlist();

  // Masquée en descendant, de retour dès qu'on remonte (13/10/2026) : tout
  // l'écran pour le contenu pendant qu'on fait défiler.
  const [hiddenByScroll, setHiddenByScroll] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setHiddenByScroll(false);
  }
  useEffect(() => {
    if (!route.visible) return;
    let lastY = window.scrollY;
    function handleScroll() {
      const y = window.scrollY;
      if (Math.abs(y - lastY) < 8) return;
      setHiddenByScroll(y > lastY && y > 120);
      lastY = y;
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [route.visible]);

  // Hauteur réellement occupée par la barre, partagée avec les boutons
  // flottants (Panier de la boutique, remonter en haut) qui se posent
  // au-dessus et la suivent quand elle se cache (`--bottom-nav-offset`).
  const shown = route.visible && !hiddenByScroll;
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(
      "--bottom-nav-offset",
      shown ? "calc(4rem + env(safe-area-inset-bottom, 0px))" : "0px"
    );
    return () => {
      root.style.setProperty("--bottom-nav-offset", "0px");
    };
  }, [shown]);

  if (!route.visible) return null;

  const isHome = route.isHome;
  const isCategoriesRoute = route.isCategories;
  const isFavoris = route.isFavoris;
  const isCompte = route.isCompte;

  return (
    <>
      {/* Plus de cale ici (13/10/2026, audit visuel) : elle se plaçait APRÈS
          le pied de page et faisait apparaître une bande blanche de 64 px
          sous le pied de page vert. Le pied de page réserve déjà lui-même
          l'espace de cette barre (`pb-24` sur mobile, site-footer.tsx). */}
      <nav
        className={`fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-ligne bg-white pb-[env(safe-area-inset-bottom,0px)] transition-transform duration-300 ease-out motion-reduce:transition-none sm:hidden ${
          hiddenByScroll ? "translate-y-full" : "translate-y-0"
        }`}
        aria-label="Navigation principale"
      >
        <Link
          href="/"
          transitionTypes={["nav-back"]}
          className={`${TAB_CLASS} ${isHome ? "text-vert-actif" : "text-encre/70"}`}
        >
          <HomeIcon />
          Accueil
        </Link>

        <Link
          href="/categories"
          className={`${TAB_CLASS} ${isCategoriesRoute ? "text-vert-actif" : "text-encre/70"}`}
        >
          <CategoriesIcon />
          Catégories
        </Link>

        <Link
          href="/paniers"
          className={`relative ${TAB_CLASS} ${isPanier || route.isPaniers ? "text-vert-actif" : "text-encre/70"}`}
        >
          <CartIcon />
          {cartCount > 0 ? (
            <span
              key={cartCount}
              className="kv-bump absolute right-[22%] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-vert-actif px-1 text-[9px] font-medium text-ivoire"
            >
              {cartCount}
            </span>
          ) : null}
          Panier
        </Link>

        <Link href="/favoris" className={`relative ${TAB_CLASS} ${isFavoris ? "text-vert-actif" : "text-encre/70"}`}>
          <HeartIcon />
          {favCount > 0 ? (
            <span className="absolute right-[22%] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-vert-actif px-1 text-[9px] font-medium text-ivoire">
              {favCount}
            </span>
          ) : null}
          Favoris
        </Link>

        <Link href="/compte" className={`${TAB_CLASS} ${isCompte ? "text-vert-actif" : "text-encre/70"}`}>
          <UserIcon />
          Compte
        </Link>
      </nav>
    </>
  );
}
