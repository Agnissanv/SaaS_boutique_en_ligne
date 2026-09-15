import Link from "next/link";
import { ViewTransition } from "react";
import { WishlistButton } from "@/components/wishlist-button";
import { ProductImage } from "@/components/product-image";
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
 * même carte sert à la bande "Nouveautés" ET à la grille du catalogue
 * complet, au lieu de dupliquer le markup entre les deux comme avant.
 * Volontairement pas touché : les cartes similaires de la page boutique
 * (`[shopSlug]`) et des favoris (`/favoris`) — hors périmètre de cette
 * demande, qui ne porte que sur la page d'accueil marketplace.
 *
 * Nom de boutique cliquable ajouté le 13/09/2026 (retour d'Isaac : "quelles
 * améliorations proposes-tu ?") : renvoie vers la boutique plutôt que
 * d'être un simple texte, pour aider à découvrir un vendeur directement
 * depuis la marketplace. Posé en dehors du <Link> vers la fiche produit
 * (jamais imbriqué dedans — deux <a> imbriqués sont invalides en HTML et
 * cassent l'hydratation), même principe déjà appliqué au bouton favoris.
 *
 * Recolorée/animée le 15/09/2026 (refonte de la page d'accueil, cf. demande
 * d'Isaac que la marketplace soit plus soignée que la page boutique) :
 * coins plus généreux et légère élévation au survol, cohérents avec les
 * cartes déjà retravaillées ailleurs sur le site. Comportement inchangé.
 *
 * Transitions d'écran ajoutées le 15/09/2026 (chantier "langage natif") :
 * `transitionTypes={["nav-forward"]}` sur les deux liens (on avance dans la
 * hiérarchie, vers un produit ou une boutique), et la vignette enveloppée
 * dans un `<ViewTransition name="product-photo-{id}">` partagé avec la
 * photo héro de la fiche produit (`product-gallery.tsx`), pour qu'elle
 * grossisse et se déplace jusque là-bas au lieu de disparaître.
 */
export function ProductCard({
  product,
  className,
}: {
  product: MarketplaceCardProduct;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-lg border border-ligne bg-white p-3 transition-all duration-150 hover:-translate-y-0.5 hover:border-cuivre-clair hover:shadow-md ${className ?? ""}`}
    >
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
      <Link href={`/${product.shopSlug}/${product.slug}`} transitionTypes={["nav-forward"]}>
        <ViewTransition name={`product-photo-${product.id}`} share="morph" default="none">
          <ProductImage
            src={product.thumbnail}
            alt={product.title}
            className="mb-2 aspect-square w-full rounded-md object-cover"
          />
        </ViewTransition>
        <p className="line-clamp-2 text-sm font-medium text-encre">{product.title}</p>
        <p className="font-mono text-sm text-cuivre-profond">{product.price} FCFA</p>
      </Link>
      <Link
        href={`/${product.shopSlug}`}
        transitionTypes={["nav-forward"]}
        className="mt-1 block truncate text-xs text-encre/60 hover:text-vert-actif hover:underline"
      >
        {product.shopName}
      </Link>
      {product.category ? (
        <p className="text-xs text-encre/50">{categoryLabel(product.category)}</p>
      ) : null}
    </div>
  );
}
