/**
 * Catégories partagées boutique/produit (cf. cahier des charges §3.1.A.2 :
 * "Mode, Beauté, Électronique, Maison, Alimentation, Autre"). Une seule
 * source de vérité — précédemment dupliquée dans shop-form.tsx,
 * boutique/actions.ts et produits/product-form.tsx (constaté le 13/09/2026
 * en construisant la marketplace, qui a besoin de la même liste pour filtrer
 * tous les produits/boutiques de la plateforme).
 */
export const CATEGORIES = [
  { value: "mode", label: "Mode" },
  { value: "beaute", label: "Beauté" },
  { value: "electronique", label: "Électronique" },
  { value: "maison", label: "Maison" },
  { value: "alimentation", label: "Alimentation" },
  { value: "autre", label: "Autre" },
] as const;

export type CategoryValue = (typeof CATEGORIES)[number]["value"];

export function isValidCategory(value: string): value is CategoryValue {
  return CATEGORIES.some((c) => c.value === value);
}

export function categoryLabel(value: string): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}
