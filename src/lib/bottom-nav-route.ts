import { RESERVED_SHOP_SLUGS } from "@/lib/utils/reserved-slugs";

/**
 * Où afficher la barre de navigation basse mobile (13/10/2026, retour
 * d'Isaac : « cette barre est visible sur presque toutes les interfaces du
 * site, ce qui n'est pas normal »).
 *
 * Avant : affichée PARTOUT sauf une courte liste d'exclusions, et tout
 * premier segment inconnu était pris pour une boutique — /faq, /blog,
 * /tarifs... devenaient la « dernière boutique visitée », vers laquelle
 * pointait ensuite l'onglet Panier (/faq/panier, page introuvable). Sur une
 * fiche produit, elle s'empilait sous la barre « Ajouter au panier » :
 * ~130 px de barres en bas d'écran.
 *
 * Maintenant, comme dans les grandes applis de vente : seulement sur les
 * écrans de NAVIGATION vers lesquels mènent ses onglets — accueil,
 * catégories, favoris, compte client, vitrine d'une boutique. Masquée sur
 * la fiche produit, le panier et la commande (parcours d'achat), les pages
 * de contenu (blog, FAQ, contact, tarifs, pages légales), l'authentification
 * et les espaces internes (vendeur, admin, commercial, partenaire).
 */
export type BottomNavRoute = {
  visible: boolean;
  /** Boutique de la page courante (vitrine, produit, panier, commande), sinon null. */
  shopSlug: string | null;
  isHome: boolean;
  isCategories: boolean;
  isFavoris: boolean;
  isCompte: boolean;
};

const ACCOUNT_AUTH_PAGES = new Set(["connexion", "inscription"]);

export function getBottomNavRoute(pathname: string): BottomNavRoute {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];
  const base = { shopSlug: null, isHome: false, isCategories: false, isFavoris: false, isCompte: false };

  if (first === undefined) return { ...base, visible: true, isHome: true };
  if (first === "categories") return { ...base, visible: segments.length === 1, isCategories: true };
  if (first === "favoris") return { ...base, visible: true, isFavoris: true };
  if (first === "compte") {
    return { ...base, visible: !ACCOUNT_AUTH_PAGES.has(segments[1] ?? ""), isCompte: true };
  }
  // Toute autre page du site (blog, faq, tarifs, admin...) : jamais une boutique.
  if (RESERVED_SHOP_SLUGS.includes(first)) return { ...base, visible: false };

  // Boutique : barre sur la vitrine seulement, pas sur produit / panier / commande.
  return { ...base, visible: segments.length === 1, shopSlug: first };
}
