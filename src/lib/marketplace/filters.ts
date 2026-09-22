/**
 * Filtres de la marketplace publique (page d'accueil `/`) ET de la page
 * boutique (`/[shopSlug]`) : recherche, catégorie, tri, pagination. Extrait
 * de `src/app/page.tsx` le 13/09/2026 en refaisant la disposition de la page
 * d'accueil (cf. demande d'Isaac) — la nouvelle bande de catégories
 * (`CategoryNav`) a besoin de construire les mêmes URLs que la page
 * elle-même, d'où la mise en commun ici plutôt qu'une copie du calcul dans
 * les deux fichiers.
 *
 * Étendu le 22/09/2026 (demande d'Isaac : "on peut maintenant attaquer les
 * filtres [...] bien poussés, bien intelligents, bien assistés") avec le
 * prix (min/max) et les attributs de spécifications par catégorie
 * (`src/lib/category-attributes.ts`, chantier du même jour). À cette
 * occasion, `buildMarketplaceHref` (câblée sur `/`) devient un simple alias
 * de `buildFilterHref(basePath, ...)`, généralisée pour aussi servir la page
 * boutique — qui avait jusqu'ici sa propre fonction dupliquée (même forme,
 * même logique) dans `[shopSlug]/page.tsx`.
 *
 * `attrs` encode chaque filtre de spécification comme des paramètres
 * `attr_<clé>` répétés (ex: `attr_marque=Samsung&attr_marque=LG`) plutôt
 * qu'une seule valeur JSON encodée dans l'URL : lisible/modifiable à la
 * main, et cohérent avec la façon dont Next.js expose déjà les paramètres
 * répétés (`string[]`) dans `searchParams`.
 */
export type MarketplaceFilters = {
  q?: string;
  categorie?: string;
  tri?: string;
  page?: string;
  prixMin?: string;
  prixMax?: string;
  attrs?: Record<string, string[]>;
};

export function buildFilterHref(
  basePath: string,
  current: MarketplaceFilters,
  overrides: MarketplaceFilters
): string {
  const merged = { ...current, ...overrides };
  const params = new URLSearchParams();
  if (merged.q) params.set("q", merged.q);
  if (merged.categorie) params.set("categorie", merged.categorie);
  if (merged.tri && merged.tri !== "recent") params.set("tri", merged.tri);
  if (merged.page && merged.page !== "1") params.set("page", merged.page);
  if (merged.prixMin) params.set("prix_min", merged.prixMin);
  if (merged.prixMax) params.set("prix_max", merged.prixMax);
  if (merged.attrs) {
    for (const [key, values] of Object.entries(merged.attrs)) {
      for (const value of values) {
        if (value) params.append(`attr_${key}`, value);
      }
    }
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function buildMarketplaceHref(
  current: MarketplaceFilters,
  overrides: MarketplaceFilters
): string {
  return buildFilterHref("/", current, overrides);
}

/**
 * Reconstruit `{ marque: ["Samsung", "LG"], ram: ["8 Go"] }` à partir des
 * `searchParams` bruts de la page (qui exposent une valeur répétée comme un
 * tableau). Ignore tout ce qui n'a pas le préfixe `attr_` — les autres clés
 * connues (`q`, `categorie`...) sont lues séparément par chaque page.
 */
export function parseAttrsFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): Record<string, string[]> {
  const attrs: Record<string, string[]> = {};
  for (const [key, rawValue] of Object.entries(searchParams)) {
    if (!key.startsWith("attr_") || rawValue === undefined) continue;
    const attrKey = key.slice("attr_".length);
    const values = (Array.isArray(rawValue) ? rawValue : [rawValue]).filter(Boolean);
    if (values.length > 0) attrs[attrKey] = values;
  }
  return attrs;
}

/** Lit un paramètre pouvant être une valeur unique ou un tableau (Next.js
 * expose un tableau dès qu'une clé est répétée dans l'URL) — ne garde que la
 * première valeur, les seuls paramètres concernés ici (`q`, `categorie`,
 * `tri`, `page`, `prix_min`, `prix_max`) n'ayant jamais de sens répétés. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
