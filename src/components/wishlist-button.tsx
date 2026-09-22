"use client";

import { useWishlist, type WishlistItem } from "@/lib/wishlist/useWishlist";

/**
 * Bouton favoris (♥/♡) réutilisable — carte produit (marketplace, catalogue
 * boutique) et fiche produit. `item` doit être sérialisable (passé par un
 * Server Component parent) : voir WishlistItem.
 */
export function WishlistButton({
  item,
  className,
}: {
  item: WishlistItem;
  className?: string;
}) {
  const { items, toggle } = useWishlist();
  const isFavorite = items.some((i) => i.productId === item.productId);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(item);
      }}
      aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
      aria-pressed={isFavorite}
      className={
        className ??
        "flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-lg shadow"
      }
    >
      <span aria-hidden="true" className={isFavorite ? "text-vert-actif" : "text-encre/40"}>
        {isFavorite ? "♥" : "♡"}
      </span>
    </button>
  );
}
