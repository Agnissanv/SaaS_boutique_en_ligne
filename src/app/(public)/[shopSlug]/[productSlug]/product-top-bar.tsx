"use client";

import Link from "next/link";
import { useShopCart } from "@/lib/cart/useShopCart";

/**
 * Barre du haut de la fiche produit sur téléphone (13/10/2026, lot 2 des
 * améliorations UX) : il n'y avait qu'un chevron posé sur la photo, sans accès
 * au panier ni partage. Retour à la boutique, nom de la boutique, partager
 * (feuille de partage du téléphone, sinon WhatsApp) et panier avec son
 * compteur, qui « rebondit » à chaque ajout.
 */
export function ProductTopBar({
  shopSlug,
  shopName,
  productTitle,
}: {
  shopSlug: string;
  shopName: string;
  productTitle: string;
}) {
  const { count } = useShopCart(shopSlug);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: productTitle, text: `${productTitle} sur KEVA`, url });
        return;
      } catch {
        // Partage annulé : rien à faire.
        return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${productTitle} — ${url}`)}`, "_blank", "noopener");
  }

  const iconButton =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-vert-sapin transition hover:bg-brume";

  return (
    <div className="sticky top-0 z-30 -mx-4 -mt-8 mb-3 flex items-center gap-1 border-b border-ligne/70 bg-white/95 px-2 py-1.5 backdrop-blur sm:hidden">
      <Link href={`/${shopSlug}`} transitionTypes={["nav-back"]} aria-label="Retour à la boutique" className={iconButton}>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
          <path d="m12.5 4.5-5.5 5.5 5.5 5.5" />
        </svg>
      </Link>
      <Link
        href={`/${shopSlug}`}
        transitionTypes={["nav-back"]}
        className="min-w-0 flex-1 truncate text-sm font-semibold text-encre"
      >
        {shopName}
      </Link>
      <button type="button" onClick={share} aria-label="Partager ce produit" className={iconButton}>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
          <path d="M10 13V3" />
          <path d="m6.5 6.5 3.5-3.5 3.5 3.5" />
          <path d="M5 10H4.5A1.5 1.5 0 0 0 3 11.5v4A1.5 1.5 0 0 0 4.5 17h11a1.5 1.5 0 0 0 1.5-1.5v-4a1.5 1.5 0 0 0-1.5-1.5H15" />
        </svg>
      </button>
      <Link href={`/${shopSlug}/panier`} aria-label={`Panier (${count})`} className={`relative ${iconButton}`}>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
          <path d="M4 6.5h12l-1 9.5H5L4 6.5Z" />
          <path d="M7 6.5V5a3 3 0 0 1 6 0v1.5" />
        </svg>
        {count > 0 ? (
          <span
            key={count}
            className="kv-bump absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-vert-actif px-1 text-[10px] font-bold text-ivoire"
          >
            {count}
          </span>
        ) : null}
      </Link>
    </div>
  );
}
