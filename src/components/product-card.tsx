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
  /**
   * Prix barré — ajouté le 17/09/2026 pour généraliser à cette carte
   * (marketplace, page d'accueil, favoris) l'affichage déjà en place sur la
   * page boutique et la fiche produit. `undefined` : pas sélectionné par
   * l'appelant (repli silencieux, comme `rating`) ; `null` : sélectionné mais
   * aucun prix barré pour ce produit.
   */
  compareAtPrice?: number | null;
  category: string | null;
  thumbnail?: string;
  shopSlug: string;
  shopName: string;
  /**
   * Note moyenne + nombre d'avis — ajoutée le 16/09/2026 (enrichissement
   * "preuve sociale dès la liste", voir migration
   * 0027_product_ratings_on_listing.sql). `undefined` : pas encore
   * chargée/non applicable (repli silencieux, pas de rendu) ; `null` :
   * chargée mais aucun avis pour ce produit (idem, pas de rendu — jamais de
   * "0 avis" qui donnerait une impression de boutique vide).
   */
  rating?: { average: number; count: number } | null;
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
  const hasDiscount =
    product.compareAtPrice != null && product.compareAtPrice > product.price;

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
            compareAtPrice: product.compareAtPrice,
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
        {/* flex-wrap : sur les cartes les plus étroites (bandes horizontales,
            grille à 2 colonnes), prix + prix barré avec des montants à 6
            chiffres ne tiennent pas toujours sur une seule ligne — même
            traitement que la page boutique publique. */}
        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0 font-mono text-sm text-cuivre-profond">
          {product.price} FCFA
          {hasDiscount ? (
            <span className="font-mono text-xs text-encre/40 line-through">
              {product.compareAtPrice} FCFA
            </span>
          ) : null}
        </p>
        {product.rating ? (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-encre/60">
            <Stars rating={product.rating.average} />
            <span>({product.rating.count})</span>
          </p>
        ) : null}
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
