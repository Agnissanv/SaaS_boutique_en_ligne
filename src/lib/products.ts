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
