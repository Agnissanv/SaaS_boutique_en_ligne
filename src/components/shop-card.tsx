import Link from "next/link";
import { Stars } from "@/components/stars";
import { categoryLabel } from "@/lib/categories";
import { VerifiedBadge } from "@/components/verified-badge";

export type MarketplaceShop = {
  slug: string;
  name: string;
  logoUrl: string | null;
  category: string | null;
  rating: { average: number; count: number } | null;
  /** Badge "Boutique vérifiée" (22/09/2026, voir migration 0042). */
  isVerified?: boolean;
};

/**
 * Carte boutique — bande "Boutiques de la plateforme" ajoutée le 13/09/2026
 * (retour d'Isaac : "quelles améliorations proposes-tu ?", "on a des
 * concurrents bien musclés"). La marketplace ne mettait en avant jusqu'ici
 * que des produits, jamais les boutiques elles-mêmes (limite explicitement
 * notée comme "non fait" le 13/09/2026 lors de la construction initiale de
 * la marketplace) — utile pour qu'un client découvre un vendeur, pas
 * seulement un article isolé.
 *
 * Réutilise `getShopRating` (créé le 14/09/2026 pour la fiche boutique) au
 * lieu d'un nouveau calcul : même note de confiance affichée partout.
 *
 * Recolorée/animée le 15/09/2026 (refonte de la page d'accueil) : mêmes
 * coins et élévation au survol que `ProductCard`, pour que les deux types de
 * carte de cette page se lisent comme une seule famille visuelle.
 *
 * `transitionTypes={["nav-forward"]}` ajouté le 15/09/2026 (chantier
 * "langage natif", transitions d'écran) : on va plus loin dans la
 * hiérarchie (marketplace → boutique), donc le contenu glisse vers la
 * gauche, comme une fiche produit.
 */
export function ShopCard({ shop, className }: { shop: MarketplaceShop; className?: string }) {
  return (
    <Link
      href={`/${shop.slug}`}
      transitionTypes={["nav-forward"]}
      className={`flex flex-col items-center gap-2 rounded-lg border border-ligne bg-white p-3 text-center transition-all duration-150 hover:-translate-y-0.5 hover:border-vert-actif hover:shadow-md ${
        className ?? ""
      }`}
    >
      {shop.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- image uploadée par le vendeur, source dynamique
        <img
          src={shop.logoUrl}
          alt={shop.name}
          className="h-16 w-16 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brume text-lg font-semibold text-vert-actif">
          {shop.name.charAt(0).toUpperCase()}
        </div>
      )}
      <p className="flex w-full items-center justify-center gap-1 text-sm font-medium text-encre">
        <span className="min-w-0 truncate">{shop.name}</span>
        {shop.isVerified ? <VerifiedBadge /> : null}
      </p>
      {shop.category ? (
        <p className="text-xs text-encre/60">{categoryLabel(shop.category)}</p>
      ) : null}
      {shop.rating ? (
        <p className="text-xs text-vert-actif">
          <Stars rating={shop.rating.average} />{" "}
          <span className="text-encre/60">({shop.rating.count})</span>
        </p>
      ) : null}
    </Link>
  );
}
