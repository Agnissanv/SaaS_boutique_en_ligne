import { getCategoryAttributeFields, getAttributeValueLabel } from "@/lib/category-attributes";

/**
 * Calcul des facettes de filtre (valeurs d'attribut réellement présentes,
 * avec leur nombre de produits, + bornes de prix réelles) — chantier
 * "filtres" du 22/09/2026, construit directement sur les specs par
 * catégorie du même jour (`src/lib/category-attributes.ts`).
 *
 * Fonction pure, volontairement séparée des pages qui l'appellent : elle ne
 * fait aucune requête elle-même, elle reçoit un échantillon borné de lignes
 * `{price, attributes}` déjà chargées (même pragmatisme que
 * `CATEGORY_FEED_LIMIT` dans `src/app/page.tsx` — un vrai calcul agrégé
 * en SQL/RPC serait plus exact mais n'est pas nécessaire à l'échelle
 * actuelle ; à revoir si le catalogue grossit significativement).
 *
 * Simplification assumée : les facettes sont calculées sur le périmètre
 * recherche + catégorie uniquement, jamais recroisées avec les autres
 * filtres d'attribut/prix déjà sélectionnés (pas de "faceted search" complet
 * à la Amazon où cocher "Samsung" recalculerait les compteurs des autres
 * facettes). Objectif : savoir quelles valeurs existent et combien de
 * produits chacune concerne, pas une exactitude totale une fois plusieurs
 * filtres combinés.
 */
export type AttributeFacetOption = {
  value: string;
  label: string;
  count: number;
};

export type AttributeFacet = {
  key: string;
  label: string;
  type: "text" | "select";
  options: AttributeFacetOption[];
};

export type PriceBounds = { min: number; max: number };

// Un champ texte libre (ex: "Caractéristiques techniques") peut avoir autant
// de valeurs distinctes que de produits — au-delà de ce seuil, une liste de
// cases à cocher n'aide plus personne (et devient un facet géant à charger
// pour rien) : le champ est simplement absent des facettes proposées. Les
// champs "select" n'ont jamais ce problème (nombre d'options fixé par
// `category-attributes.ts`).
const MAX_TEXT_FACET_OPTIONS = 25;

export function computeAttributeFacets(
  category: string | null | undefined,
  rows: { price: number; attributes: Record<string, string> | null }[]
): { facets: AttributeFacet[]; priceBounds: PriceBounds | null } {
  let priceBounds: PriceBounds | null = null;
  for (const row of rows) {
    if (typeof row.price !== "number" || Number.isNaN(row.price)) continue;
    priceBounds = priceBounds
      ? { min: Math.min(priceBounds.min, row.price), max: Math.max(priceBounds.max, row.price) }
      : { min: row.price, max: row.price };
  }

  const fields = getCategoryAttributeFields(category);
  const facets: AttributeFacet[] = [];
  for (const field of fields) {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const value = row.attributes?.[field.key];
      if (!value) continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    if (counts.size === 0) continue;
    if (field.type === "text" && counts.size > MAX_TEXT_FACET_OPTIONS) continue;

    const options = Array.from(counts.entries())
      .map(([value, count]) => ({
        value,
        label: field.type === "select" ? getAttributeValueLabel(category, field.key, value) : value,
        count,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "fr"));

    facets.push({ key: field.key, label: field.label, type: field.type, options });
  }

  return { facets, priceBounds };
}
