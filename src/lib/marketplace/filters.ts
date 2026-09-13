/**
 * Filtres de la marketplace publique (page d'accueil `/`) : recherche,
 * catégorie, tri, pagination. Extrait de `src/app/page.tsx` le 13/09/2026 en
 * refaisant la disposition de la page d'accueil (cf. demande d'Isaac) — la
 * nouvelle bande de catégories (`CategoryNav`) a besoin de construire les
 * mêmes URLs que la page elle-même, d'où la mise en commun ici plutôt qu'une
 * copie du calcul dans les deux fichiers.
 */
export type MarketplaceFilters = {
  q?: string;
  categorie?: string;
  tri?: string;
  page?: string;
};

export function buildMarketplaceHref(
  current: MarketplaceFilters,
  overrides: MarketplaceFilters
): string {
  const params = new URLSearchParams();
  const merged = { ...current, ...overrides };
  if (merged.q) params.set("q", merged.q);
  if (merged.categorie) params.set("categorie", merged.categorie);
  if (merged.tri && merged.tri !== "recent") params.set("tri", merged.tri);
  if (merged.page && merged.page !== "1") params.set("page", merged.page);
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}
