import Link from "next/link";
import { WishlistButton } from "@/components/wishlist-button";
import { categoryLabel } from "@/lib/categories";

export type MarketplaceCardProduct = {
  id: string;
  slug: string;
  title: string;
  price: number;
  category: string | null;
  thumbnail?: string;
  shopSlug: string;
  shopName: string;
};

/**
 * Carte produit de la marketplace — extraite le 13/09/2026 en refaisant la
 * disposition de la page d'accueil (cf. demande d'Isaac, inspirée de la
 * page d'accueil Jumia qu'il a partagée en exemple, sans la copier). La
 * même carte sert maintenant à la bande "Nouveautés" ET à la grille du
 * catalogue complet, au lieu de dupliquer le markup entre les deux comme
 * avant. Volontairement pas touché : les cartes similaires de la page
 * boutique (`[shopSlug]`) et des favoris (`/favoris`) — hors périmètre de
 * cette demande, qui ne porte que sur la page d'accueil marketplace.
 */
export function ProductCard({
  product,
  className,
}: {
  product: MarketplaceCardProduct;
  className?: string;
}) {
  return (
    <div className={`relative rounded border border-gray-200 p-3 ${className ?? ""}`}>
      <div className="absolute right-2 top-2 z-10">
        <WishlistButton
          item={{
            productId: product.id,
            shopSlug: product.shopSlug,
            productSlug: product.slug,
            title: product.title,
            price: product.price,
            imageUrl: product.thumbnail,
          }}
        />
      </div>
      <Link href={`/${product.shopSlug}/${product.slug}`}>
        {product.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element -- image uploadée par le vendeur, source dynamique
          <img
            src={product.thumbnail}
            alt={product.title}
            className="mb-2 aspect-square w-full rounded object-cover"
          />
        ) : (
          <div className="mb-2 aspect-square w-full rounded bg-gray-100" />
        )}
        <p className="line-clamp-2 text-sm font-medium text-gray-900">{product.title}</p>
        <p className="text-sm text-gray-600">{product.price} FCFA</p>
        <p className="mt-1 truncate text-xs text-gray-500">{product.shopName}</p>
        {product.category ? (
          <p className="text-xs text-gray-400">{categoryLabel(product.category)}</p>
        ) : null}
      </Link>
    </div>
  );
}
