"use client";

import { useEffect } from "react";
import { useRecentlyViewed, type RecentlyViewedItem } from "@/lib/recently-viewed/useRecentlyViewed";

/**
 * Enregistre discrètement une consultation de fiche produit dans
 * l'historique "vus récemment" (localStorage) — ne rend rien à l'écran.
 * Composant client séparé (plutôt qu'un simple `useEffect` dans la page,
 * qui est un Server Component) : voir `useWishlist`/`WishlistButton` pour le
 * même principe déjà en place ailleurs sur les pages publiques.
 */
export function RecordProductView({ item }: { item: RecentlyViewedItem }) {
  const { record } = useRecentlyViewed();
  // Déstructuré en champs primitifs plutôt que de dépendre de `item`
  // directement : `item` est un objet neuf à chaque rendu (créé inline par
  // l'appelant), ce qui redéclencherait l'effet en boucle si on l'utilisait
  // tel quel comme dépendance.
  const { productId, shopSlug, shopName, productSlug, title, price, compareAtPrice, imageUrl } =
    item;

  useEffect(() => {
    record({ productId, shopSlug, shopName, productSlug, title, price, compareAtPrice, imageUrl });
  }, [productId, shopSlug, shopName, productSlug, title, price, compareAtPrice, imageUrl, record]);

  return null;
}
