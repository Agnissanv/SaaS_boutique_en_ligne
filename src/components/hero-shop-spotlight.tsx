import Link from "next/link";
import Image from "next/image";
import { ProductImage } from "@/components/product-image";
import { VerifiedBadge } from "@/components/verified-badge";
import { categoryLabel } from "@/lib/categories";
import type { MarketplaceCardProduct } from "@/components/product-card";
import type { MarketplaceShop } from "@/components/shop-card";

/**
 * "Boutique à la une" du hero — remplace le carrousel de produits isolés
 * (retour de pros du métier, 06/10/2026 : le hero "sentait l'IA", un schéma
 * de template). Montre un vrai vendeur — logo, nom, ville, photos de SES
 * produits, prix — plutôt qu'une pile de vignettes anonymes : c'est ce qu'un
 * template ne peut pas avoir, et ce qui prouve qu'il y a des gens derrière la
 * plateforme.
 *
 * Aucune donnée inventée : la boutique est choisie par `page.tsx` parmi les
 * boutiques déjà chargées, uniquement si elle a au moins 2 produits avec une
 * photo (sinon le hero retombe sur `HeroFeaturedSlideshow`). Server
 * Component : aucune interaction à gérer, les photos sont des liens.
 */
export function HeroShopSpotlight({
  shop,
  ville,
  photos,
  className,
}: {
  shop: MarketplaceShop;
  ville: string | null;
  photos: MarketplaceCardProduct[];
  className?: string;
}) {
  const [main, ...rest] = photos;
  const meta = [ville, shop.category ? categoryLabel(shop.category) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={`overflow-hidden rounded-lg border border-ligne bg-white shadow-[0_18px_40px_rgba(14,59,44,0.10)] ${
        className ?? ""
      }`}
    >
      <div className="flex items-center gap-3 border-b border-ligne px-4 py-3">
        {shop.logoUrl ? (
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-brume">
            <Image src={shop.logoUrl} alt={shop.name} fill sizes="44px" className="object-cover" />
          </div>
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brume text-base font-semibold text-vert-actif">
            {shop.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cuivre-profond">
            Boutique à la une
          </p>
          <p className="flex items-center gap-1 text-sm font-semibold text-encre">
            <span className="min-w-0 truncate">{shop.name}</span>
            {shop.isVerified ? <VerifiedBadge /> : null}
          </p>
          {meta ? <p className="truncate text-xs text-encre/60">{meta}</p> : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1 p-1">
        <Link
          href={`/${main.shopSlug}/${main.slug}`}
          className={`group relative block overflow-hidden rounded-md ${
            rest.length > 0 ? "row-span-2" : ""
          }`}
        >
          <ProductImage
            src={main.thumbnail}
            alt={main.title}
            className="h-full min-h-72 w-full transition duration-500 group-hover:scale-[1.03]"
          />
          <PriceTag product={main} />
        </Link>
        {rest.slice(0, 2).map((p) => (
          <Link
            key={p.id}
            href={`/${p.shopSlug}/${p.slug}`}
            className="group relative block aspect-square overflow-hidden rounded-md"
          >
            <ProductImage
              src={p.thumbnail}
              alt={p.title}
              className="h-full w-full transition duration-500 group-hover:scale-[1.03]"
            />
            <PriceTag product={p} />
          </Link>
        ))}
      </div>

      <Link
        href={`/${shop.slug}`}
        transitionTypes={["nav-forward"]}
        className="m-3 mt-2 flex items-center justify-center gap-2 rounded-md bg-vert-sapin px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-vert-actif"
      >
        Voir la boutique
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

function PriceTag({ product }: { product: MarketplaceCardProduct }) {
  return (
    <span className="absolute bottom-1.5 left-1.5 rounded bg-white/95 px-2 py-1 font-mono text-[11px] font-semibold text-vert-sapin">
      {product.price.toLocaleString("fr-FR")} FCFA
    </span>
  );
}
