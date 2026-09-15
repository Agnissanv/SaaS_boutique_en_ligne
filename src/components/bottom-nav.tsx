"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useShopCart } from "@/lib/cart/useShopCart";
import { useWishlist } from "@/lib/wishlist/useWishlist";
import { useLastVisitedShop } from "@/lib/shop/useLastVisitedShop";

// Racines masquant la barre : portails d'authentification (leur propre
// gabarit carte/logo suffit, pas besoin d'une navigation en plus) et espaces
// internes vendeur/admin (déjà leur propre navigation dédiée, sidebar ou
// barre en pastilles). "favoris" et "compte" ne sont volontairement PAS
// listés ici : ce sont des surfaces client à part entière, la barre y reste
// visible.
const HIDDEN_ROOTS = new Set([
  "connexion",
  "inscription",
  "admin",
  "dashboard",
  "auth",
  "api",
]);

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

/**
 * Barre de navigation basse, mobile uniquement (`sm:hidden`) — chantier
 * responsive design ouvert le 15/09/2026. Isaac a partagé le modèle Jumia
 * (Accueil/Catégories/Panier/Favoris/Compte fixe en bas d'écran) comme
 * inspiration ; deux écarts délibérés, tranchés avec lui avant de coder
 * (question à choix multiples) :
 *
 * - **"Panier" pointe vers la DERNIÈRE boutique visitée** (voir
 *   useLastVisitedShop.ts), grisé/inactif si le client n'a encore visité
 *   aucune boutique dans son navigateur — chez Jumia le panier est global
 *   (un seul vendeur), chez nous il est scopé par boutique (une commande =
 *   une seule boutique, voir useShopCart.ts), donc un onglet "Panier"
 *   toujours actif n'aurait pas de destination unique évidente.
 * - **"Catégories" n'ouvre pas de nouvelle page** (aucune n'existe et n'est
 *   pas prévue) : sur l'accueil, scrolle jusqu'à la bande de catégories déjà
 *   présente (`#categories`, sous le hero) ; ailleurs, y renvoie via
 *   `/#categories`. Réutilise le panneau existant plutôt que d'en dupliquer
 *   un nouveau.
 *
 * Rendue une seule fois, au niveau du layout racine (`layout.tsx`), plutôt
 * que dans chaque page — visible sur les surfaces client (accueil
 * marketplace, page boutique, fiche produit, panier, confirmation de
 * commande, favoris, compte), masquée sur les portails d'authentification et
 * les espaces internes vendeur/admin (déjà leur propre navigation, voir
 * HIDDEN_ROOTS ci-dessus).
 */
export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];

  const isHiddenRoute = first !== undefined && HIDDEN_ROOTS.has(first);
  const isFavoris = first === "favoris";
  const isCompte = first === "compte";
  const isShopRoute = first !== undefined && !isHiddenRoute && !isFavoris && !isCompte;
  const currentShop = isShopRoute ? first : null;

  const { shopSlug: lastShop, setShopSlug } = useLastVisitedShop();

  // Mémorise la boutique courante comme "dernière visitée" dès qu'on est sur
  // une page boutique — synchronisation vers un store externe (localStorage),
  // pas un calcul dérivable au rendu : useEffect est l'outil approprié ici,
  // pas le pattern déjà évité ailleurs dans ce projet (calculer une valeur
  // qui pourrait l'être directement pendant le rendu).
  useEffect(() => {
    if (currentShop) setShopSlug(currentShop);
  }, [currentShop, setShopSlug]);

  const effectiveShop = currentShop ?? lastShop;
  const { count: cartCount } = useShopCart(effectiveShop ?? "");
  const { count: favCount } = useWishlist();

  if (isHiddenRoute) return null;

  const isHome = segments.length === 0;
  const isPanier = isShopRoute && segments[1] === "panier";

  function goToCategories() {
    if (isHome) {
      document.getElementById("categories")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      router.push("/#categories");
    }
  }

  return (
    <>
      {/* Cale de la même hauteur que la barre fixe ci-dessous : ajoute de
          l'espace en fin de document pour que le contenu de la page ne soit
          jamais masqué en bas d'écran une fois complètement scrollé. */}
      <div className="h-16 sm:hidden" aria-hidden="true" />
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-ligne bg-white pb-[env(safe-area-inset-bottom,0px)] sm:hidden"
        aria-label="Navigation principale"
      >
        <Link href="/" className={`${TAB_CLASS} ${isHome ? "text-cuivre-profond" : "text-encre/60"}`}>
          <HomeIcon />
          Accueil
        </Link>

        <button type="button" onClick={goToCategories} className={`${TAB_CLASS} text-encre/60`}>
          <CategoriesIcon />
          Catégories
        </button>

        {effectiveShop ? (
          <Link
            href={`/${effectiveShop}/panier`}
            className={`relative ${TAB_CLASS} ${isPanier ? "text-cuivre-profond" : "text-encre/60"}`}
          >
            <CartIcon />
            {cartCount > 0 ? (
              <span className="absolute right-[22%] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-cuivre-profond px-1 text-[9px] font-medium text-ivoire">
                {cartCount}
              </span>
            ) : null}
            Panier
          </Link>
        ) : (
          <span className={`${TAB_CLASS} text-encre/30`} aria-disabled="true">
            <CartIcon />
            Panier
          </span>
        )}

        <Link href="/favoris" className={`relative ${TAB_CLASS} ${isFavoris ? "text-cuivre-profond" : "text-encre/60"}`}>
          <HeartIcon />
          {favCount > 0 ? (
            <span className="absolute right-[22%] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-cuivre-profond px-1 text-[9px] font-medium text-ivoire">
              {favCount}
            </span>
          ) : null}
          Favoris
        </Link>

        <Link href="/compte" className={`${TAB_CLASS} ${isCompte ? "text-cuivre-profond" : "text-encre/60"}`}>
          <UserIcon />
          Compte
        </Link>
      </nav>
    </>
  );
}
