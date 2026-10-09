import type { SearchDoc, SearchOutcome } from "./engine";

/**
 * Filtres et tri appliqués aux résultats du moteur (09/10/2026) — partagés
 * par la marketplace et la page boutique. Mêmes règles que les grilles sans
 * recherche : prix filtré sur le prix brut, filtres de caractéristiques
 * seulement une fois une catégorie choisie.
 */
export function refineSearchResults(
  outcome: SearchOutcome,
  options: {
    categorie?: string;
    prixMin?: string;
    prixMax?: string;
    attrs: Record<string, string[]>;
    sort: string;
  }
): {
  /** Résultats du rayon choisi (ou tous) : base des facettes de filtre. */
  inCategory: SearchDoc[];
  /** Résultats après tous les filtres, dans l'ordre demandé. */
  matches: SearchDoc[];
} {
  const { categorie, prixMin, prixMax, attrs, sort } = options;
  const inCategory = outcome.results
    .map((r) => r.doc)
    .filter((doc) => !categorie || doc.category === categorie);
  const matches = inCategory.filter((doc) => {
    if (prixMin && doc.price < Number(prixMin)) return false;
    if (prixMax && doc.price > Number(prixMax)) return false;
    if (categorie) {
      for (const [key, values] of Object.entries(attrs)) {
        if (!values.includes(doc.attributes?.[key] ?? "")) return false;
      }
    }
    return true;
  });
  // "pertinence" : ordre du moteur, déjà trié par score.
  if (sort === "recent") matches.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  else if (sort === "prix_asc") matches.sort((a, b) => a.price - b.price);
  else if (sort === "prix_desc") matches.sort((a, b) => b.price - a.price);
  return { inCategory, matches };
}

/** Remet des lignes chargées par `.in("id", ids)` dans l'ordre de `ids`. */
export function orderByIds<T extends { id: string }>(rows: T[], ids: string[]): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => byId.get(id)).filter((row): row is T => Boolean(row));
}
