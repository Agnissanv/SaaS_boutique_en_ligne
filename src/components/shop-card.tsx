import Link from "next/link";
import Image from "next/image";
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
 *
 * Logo passé à `next/image` le 23/09/2026 (audit PageSpeed transmis par
 * Isaac : "Améliorer l'affichage des images", 146 Kio d'économie estimée
 * sur la page d'accueil) : c'était le seul `<img>` brut encore servi SUR le
 * premier chargement de la marketplace — jusqu'à 10 logos vendeur (bande
 * "Boutiques sur KEVA"), potentiellement de gros fichiers uploadés tels
 * quels, sans redimensionnement ni format moderne. `ProductImage` avait déjà
 * ce même traitement le 16/09/2026 ; les autres `<img>` bruts du projet
 * (galerie produit en zoom, formulaires d'upload, avatars du dashboard) ne
 * chargent pas au premier affichage d'une page publique et restent hors
 * périmètre. Taille fixe et connue (h-16 w-16) → `sizes="64px"`, pas besoin
 * de l'approximation par largeur d'écran de `ProductImage`.
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
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-brume">
          <Image src={shop.logoUrl} alt={shop.name} fill sizes="64px" className="object-cover" />
        </div>
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
