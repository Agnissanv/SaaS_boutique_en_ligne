import Link from "next/link";
import { ViewTransition } from "react";
import { WishlistButton } from "@/components/wishlist-button";
import { ProductImage } from "@/components/product-image";
import { Stars } from "@/components/stars";
import { categoryLabel } from "@/lib/categories";

export type MarketplaceCardProduct = {
  id: string;
  slug: string;
  title: string;
  price: number;
  compareAtPrice?: number | null;
  category: string | null;
  thumbnail?: string;
  shopSlug: string;
  shopName: string;
  rating?: { average: number; count: number } | null;
};

export function ProductCard({
  product,
  className,
}: {
  product: MarketplaceCardProduct;
  className?: string;
}) {
  const hasDiscount =
    product.compareAtPrice != null && product.compareAtPrice > product.price;

  return (
    <div
      className={`group relative bg-white ${className ?? ""}`}
    >
      {/* Wishlist */}
      <div className="absolute right-2 top-2 z-10">
        <WishlistButton
          item={{
            productId: product.id,
            shopSlug: product.shopSlug,
            productSlug: product.slug,
            title: product.title,
            price: product.price,
            compareAtPrice: product.compareAtPrice,
            imageUrl: product.thumbnail,
          }}
        />
      </div>

      {/* Image + infos produit */}
      <Link
        href={`/${product.shopSlug}/${product.slug}`}
        transitionTypes={["nav-forward"]}
        className="block"
      >
        <ViewTransition name={`product-photo-${product.id}`} share="morph" default="none">
          <div className="overflow-hidden rounded-md bg-brume">
            <ProductImage
              src={product.thumbnail}
              alt={product.title}
              className="aspect-square w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            />
          </div>
        </ViewTransition>

        <div className="mt-3 space-y-1">
          <p className="line-clamp-2 text-[13px] font-medium leading-snug text-encre">
            {product.title}
          </p>

          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="font-mono text-[15px] font-semibold text-cuivre-profond">
              {product.price.toLocaleString("fr-FR")} FCFA
            </span>
            {hasDiscount ? (
              <span className="font-mono text-xs text-encre/40 line-through">
                {product.compareAtPrice?.toLocaleString("fr-FR")} FCFA
              </span>
            ) : null}
          </div>

          {product.rating ? (
            <div className="flex items-center gap-1 text-xs text-encre/55">
              <Stars rating={product.rating.average} />
              <span>({product.rating.count})</span>
            </div>
          ) : null}
        </div>
      </Link>

      {/* Boutique */}
      <Link
        href={`/${product.shopSlug}`}
        transitionTypes={["nav-forward"]}
        className="mt-1.5 block truncate text-xs text-encre/50 transition hover:text-vert-actif"
      >
        {product.shopName}
      </Link>

      {product.category ? (
        <p className="mt-0.5 text-[11px] text-encre/40">
          {categoryLabel(product.category)}
        </p>
      ) : null}
    </div>
  );
}