/**
 * Slugs réservés — 30/09/2026, correctif d'audit technique.
 *
 * Bug trouvé : ni le slug de boutique (saveShop, dashboard/boutique/actions.ts)
 * ni le slug de produit (saveProduct, dashboard/produits/actions.ts) n'étaient
 * jamais comparés aux segments de route STATIQUES déjà pris par le projet.
 * Next.js fait toujours passer une route statique avant une route dynamique
 * de même niveau (`app/tarifs/page.tsx` avant `app/(public)/[shopSlug]/
 * page.tsx`) — si un vendeur choisissait "tarifs" comme nom de boutique, sa
 * boutique devenait invisible en silence : `/tarifs` affichait la page
 * statique, jamais une erreur, jamais un indice pour le vendeur ni pour
 * Isaac.
 *
 * Deux listes séparées car les deux collisions ne se jouent pas au même
 * niveau d'URL :
 * - RESERVED_SHOP_SLUGS : chaque dossier statique à la racine de src/app
 *   (hors groupes de routes, qui n'ajoutent pas de segment d'URL) —
 *   collision avec `/<slug>` (page boutique, (public)/[shopSlug]/page.tsx).
 * - RESERVED_PRODUCT_SLUGS : les seuls sous-dossiers statiques sous
 *   `(public)/[shopSlug]/`, à savoir `panier` et `commande` — collision avec
 *   `/<shopSlug>/<slug>` (fiche produit, [shopSlug]/[productSlug]/page.tsx).
 *
 * Tenue à jour manuellement : toute nouvelle route statique ajoutée
 * directement sous src/app/ (ou sous [shopSlug]/) doit être ajoutée ici.
 */
export const RESERVED_SHOP_SLUGS: readonly string[] = [
  "admin",
  "commercial",
  "compte",
  "dashboard",
  "api",
  "auth",
  "blog",
  "categories",
  "charte-vendeur",
  "conditions-utilisation",
  "connexion",
  "contact",
  "favoris",
  "inscription",
  "politique-confidentialite",
  "tarifs",
];

export const RESERVED_PRODUCT_SLUGS: readonly string[] = ["panier", "commande"];

export function isReservedShopSlug(slug: string): boolean {
  return RESERVED_SHOP_SLUGS.includes(slug);
}

export function isReservedProductSlug(slug: string): boolean {
  return RESERVED_PRODUCT_SLUGS.includes(slug);
}
