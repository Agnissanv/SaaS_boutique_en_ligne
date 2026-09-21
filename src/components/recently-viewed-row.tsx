"use client";

import { useRecentlyViewed } from "@/lib/recently-viewed/useRecentlyViewed";
import { ProductRow } from "@/components/product-row";
import type { MarketplaceCardProduct } from "@/components/product-card";

/**
 * Bande "Vu récemment" — lit l'historique client (localStorage, voir
 * `useRecentlyViewed`) et le rend avec le `ProductRow`/`ProductCard`
 * partagés, pour un rendu identique aux autres bandes de la marketplace.
 * Composant client car l'historique n'existe que dans le navigateur du
 * visiteur (pas de compte client, rien à lire côté serveur) — même
 * situation que `/favoris`.
 *
 * `excludeProductId` : sur la fiche produit elle-même, on ne veut pas
 * proposer "vu récemment" avec le produit affiché en tête de liste.
 *
 * Ne rend rien (retourne `null`) si l'historique est vide — même principe
 * que les autres bandes de la page d'accueil, jamais de section vide
 * affichée "en dur".
 */
export function RecentlyViewedRow({ excludeProductId }: { excludeProductId?: string }) {
  const { items } = useRecentlyViewed();

  const products: MarketplaceCardProduct[] = items
    .filter((item) => item.productId !== excludeProductId)
    .map((item) => ({
      id: item.productId,
      slug: item.productSlug,
      title: item.title,
      price: item.price,
      compareAtPrice: item.compareAtPrice,
      category: null,
      thumbnail: item.imageUrl,
      shopSlug: item.shopSlug,
      shopName: item.shopName,
    }));

  return <ProductRow title="Vu récemment" products={products} />;
}
