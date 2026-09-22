/**
 * Constantes/helpers produit partagés — extrait le 15/09/2026 (refonte
 * visuelle du tableau produits vendeur, sur inspiration d'une maquette
 * envoyée par le designer UX/UI d'Isaac) pour ne pas dupliquer le seuil de
 * stock bas entre `/dashboard` (alerte, existant depuis le 13/09/2026) et
 * `/dashboard/produits` (nouvelle barre de santé du stock ci-dessous).
 *
 * `stockHealth`/`STOCK_HEALTH_*` : la maquette affichait une barre de stock
 * avec un chiffre "objectif" (ex: 900/1000) — concept qui n'existe pas dans
 * nos données (juste un stock réel + ce seuil d'alerte, pas de notion de
 * stock cible par produit). Adapté en une barre de SANTÉ du stock (couleur
 * + longueur relative au seuil existant), jamais un chiffre inventé — choix
 * confirmé par Isaac le 15/09/2026.
 */
export const LOW_STOCK_THRESHOLD = 5;

export type StockHealth = "rupture" | "faible" | "sain";

/**
 * `threshold` : seuil d'alerte propre au produit (`products.stock_alert_threshold`,
 * ajouté le 16/09/2026 — plan Pro uniquement, `has_advanced_stock_alerts`,
 * voir migration 0021_stock_alert_threshold.sql). `null`/`undefined` retombe
 * sur `LOW_STOCK_THRESHOLD`, comme avant pour tous les autres plans.
 */
export function stockHealth(stock: number, threshold: number | null = LOW_STOCK_THRESHOLD): StockHealth {
  const effectiveThreshold = threshold ?? LOW_STOCK_THRESHOLD;
  if (stock <= 0) return "rupture";
  if (stock <= effectiveThreshold) return "faible";
  return "sain";
}

export const STOCK_HEALTH_LABELS: Record<StockHealth, string> = {
  rupture: "Rupture de stock",
  faible: "Stock faible",
  sain: "En stock",
};

// Classes Tailwind complètes en dur (jamais construites par template
// literal type `bg-${color}`) : Tailwind ne génère le CSS que pour les noms
// de classe qu'il peut voir littéralement dans le code source.
export const STOCK_HEALTH_BAR_CLASS: Record<StockHealth, string> = {
  rupture: "bg-erreur",
  faible: "bg-attention",
  sain: "bg-succes",
};

/**
 * Prix promo daté ("prix soldé") — ajouté le 22/09/2026, migration
 * 0031_product_universal_features.sql. Distinct de `compareAtPrice`, qui
 * reste un prix barré PERMANENT (ex: prix "normal" toujours affiché barré).
 * `salePrice` n'est affiché à la place de `price` que pendant la fenêtre
 * [saleStartsAt, saleEndsAt] — calculé côté application (pas de job cron
 * côté base pour "activer" la promo à une date donnée).
 *
 * Une seule fonction `getEffectivePrice` centralise ce calcul pour que tous
 * les points d'affichage (page produit, fiche boutique, page d'accueil
 * marketplace, product-card) utilisent exactement la même logique — même
 * pattern que `ORDER_STATUS_LABELS`/`NOTIFICATION_KIND_LABEL` (une seule
 * source de vérité par comportement partagé).
 */
export type ProductPriceInput = {
  price: number;
  compareAtPrice: number | null;
  salePrice?: number | null;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
};

export type EffectivePrice = {
  /** Prix à afficher comme prix principal (soldé si la promo est active, sinon le prix normal). */
  price: number;
  /** Prix de référence à afficher barré, s'il y en a un (le prix normal pendant une promo, sinon compareAtPrice). */
  compareAtPrice: number | null;
  /** true si une promo datée est active en ce moment (permet d'afficher un badge "Promo"). */
  isOnSale: boolean;
};

/**
 * `saleStartsAt`/`saleEndsAt` à `null` = pas de borne de ce côté (promo
 * active dès maintenant si `saleStartsAt` est vide, ou sans date de fin si
 * `saleEndsAt` est vide) — un vendeur n'est jamais obligé de renseigner les
 * deux dates (cf. contrainte `products_sale_window_order`, qui n'exige un
 * ordre que si les deux sont renseignées).
 */
export function isSaleActive(
  salePrice: number | null | undefined,
  saleStartsAt: string | null | undefined,
  saleEndsAt: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (salePrice == null) return false;
  if (saleStartsAt && new Date(saleStartsAt) > now) return false;
  if (saleEndsAt && new Date(saleEndsAt) < now) return false;
  return true;
}

export function getEffectivePrice(product: ProductPriceInput, now: Date = new Date()): EffectivePrice {
  const onSale = isSaleActive(product.salePrice, product.saleStartsAt, product.saleEndsAt, now);
  if (onSale) {
    return { price: product.salePrice as number, compareAtPrice: product.price, isOnSale: true };
  }
  return { price: product.price, compareAtPrice: product.compareAtPrice, isOnSale: false };
}
