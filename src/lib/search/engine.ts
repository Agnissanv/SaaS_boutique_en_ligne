import { CATEGORIES } from "@/lib/categories";
import { CATEGORY_KEYWORDS, CONCEPTS } from "./lexicon";
import { boundedLevenshtein, tokenize, typoTolerance } from "./text";

/**
 * Moteur de recherche de la marketplace (09/10/2026).
 *
 * Remplace le `ilike '%texte%'` sur le seul titre, qui ne trouvait rien pour
 * « vêtements », « ordinateur » ou « cle usb » (sans accent) alors que la
 * plateforme en vend. Fonctionne en mémoire sur les produits actifs (voir
 * `loadSearchDocs`) : suffisant et rapide jusqu'à quelques milliers de
 * produits ; au-delà, la même logique pourra être portée en recherche
 * plein texte Postgres.
 *
 * Score d'un produit, pour chaque mot de la requête (le meilleur cas compte) :
 *   - mot présent dans le titre ............................... 10
 *   - début d'un mot du titre (« ordi » -> « ordinateur ») ....  7
 *   - mot de la même famille dans le titre (« pc » pour
 *     « ordinateur », voir CONCEPTS) ...........................  6
 *   - mot du titre à une faute de frappe près .................  5
 *   - mot présent dans la description, les tags, les
 *     caractéristiques ou le nom de la boutique ................  4
 *   - mot de la même famille dans ces mêmes champs ............  3
 * Bonus : tous les mots trouvés (+5), expression exacte dans le titre (+8),
 * produit d'une catégorie désignée par la requête (+4 par terme qui la désigne,
 * 2 au plus — c'est ce qui fait
 * remonter tous les vêtements pour « vêtements »).
 */

export type SearchDoc = {
  id: string;
  title: string;
  /** Texte secondaire : description (tronquée), tags, points forts, caractéristiques. */
  details: string;
  category: string | null;
  shopName: string;
  createdAt: string;
  /** Prix brut (même règle que les filtres de prix existants). */
  price: number;
  attributes: Record<string, string> | null;
};

export type SearchOutcome = {
  results: { doc: SearchDoc; score: number }[];
  /** Catégories désignées par la requête (« vêtements » -> mode, mode_femme...). */
  inferredCategories: string[];
  /** Requête corrigée quand une faute de frappe a été rattrapée, sinon null. */
  correctedQuery: string | null;
  /**
   * Au moins un produit contient les mots cherchés ou un mot de leur famille
   * (sinon, les résultats ne viennent que de la catégorie désignée).
   */
  hasDirectMatch: boolean;
};

type Term = { single: string } | { phrase: string };

function toTerms(words: string[]): Term[] {
  return words
    .map((word) => tokenize(word))
    .filter((tokens) => tokens.length > 0)
    .map((tokens) => (tokens.length === 1 ? { single: tokens[0] } : { phrase: tokens.join(" ") }));
}

// Lexique préparé une seule fois (formes normalisées + racinisées).
const CATEGORY_TERMS = CATEGORIES.map((c) => ({
  category: c.value as string,
  terms: toTerms([c.label, ...(CATEGORY_KEYWORDS[c.value] ?? [])]),
}));
const CONCEPT_TERMS = CONCEPTS.map(toTerms);
const LEXICON_VOCABULARY = new Set<string>();
for (const entry of [...CATEGORY_TERMS.flatMap((c) => c.terms), ...CONCEPT_TERMS.flat()]) {
  if ("single" in entry) LEXICON_VOCABULARY.add(entry.single);
  else for (const t of entry.phrase.split(" ")) LEXICON_VOCABULARY.add(t);
}

// Forme lisible d'un mot racinisé (« chemis » -> « chemise », « telephon » ->
// « téléphone »), pour afficher une requête corrigée naturelle.
const LEXICON_SURFACE = new Map<string, string>();
for (const word of [...Object.values(CATEGORY_KEYWORDS).flat(), ...CONCEPTS.flat()]) {
  const tokens = tokenize(word);
  if (tokens.length === 1 && !LEXICON_SURFACE.has(tokens[0])) LEXICON_SURFACE.set(tokens[0], word.toLowerCase());
}

function addSurfaceForms(title: string, surface: Map<string, string>) {
  for (const raw of title.split(/\s+/)) {
    const tokens = tokenize(raw);
    if (tokens.length === 1 && !surface.has(tokens[0])) {
      surface.set(tokens[0], raw.toLowerCase().replace(/[^\p{L}\p{N}-]/gu, ""));
    }
  }
}

function termMatchesQuery(term: Term, tokens: Set<string>, joined: string): boolean {
  return "single" in term ? tokens.has(term.single) : ` ${joined} `.includes(` ${term.phrase} `);
}

type PreparedDoc = {
  doc: SearchDoc;
  titleTokens: string[];
  titleSet: Set<string>;
  titleJoined: string;
  detailSet: Set<string>;
  detailJoined: string;
};

function prepare(doc: SearchDoc): PreparedDoc {
  const titleTokens = tokenize(doc.title);
  const detailTokens = tokenize(`${doc.details} ${doc.shopName}`);
  return {
    doc,
    titleTokens,
    titleSet: new Set(titleTokens),
    titleJoined: titleTokens.join(" "),
    detailSet: new Set(detailTokens),
    detailJoined: detailTokens.join(" "),
  };
}

/** Corrige un mot inconnu vers le mot connu le plus proche (fautes de frappe). */
function correctToken(token: string, vocabulary: Set<string>): string {
  const tolerance = typoTolerance(token);
  if (tolerance === 0 || vocabulary.has(token)) return token;
  // Début d'un mot connu (« ordi », « chauss ») : pas une faute, on garde.
  for (const word of vocabulary) if (word.startsWith(token)) return token;
  let best = token;
  let bestDistance = tolerance + 1;
  for (const word of vocabulary) {
    if (Math.abs(word.length - token.length) > tolerance) continue;
    const d = boundedLevenshtein(token, word, tolerance);
    if (d < bestDistance) {
      bestDistance = d;
      best = word;
    }
  }
  return best;
}

export function searchDocs(docs: SearchDoc[], rawQuery: string): SearchOutcome {
  const originalTokens = tokenize(rawQuery);
  if (originalTokens.length === 0) {
    return { results: [], inferredCategories: [], correctedQuery: null, hasDirectMatch: false };
  }

  const prepared = docs.map(prepare);

  // Fautes de frappe : vocabulaire = lexique + mots réellement présents dans le catalogue.
  const vocabulary = new Set(LEXICON_VOCABULARY);
  const surface = new Map(LEXICON_SURFACE);
  for (const p of prepared) {
    for (const t of p.titleTokens) vocabulary.add(t);
    for (const t of p.detailSet) vocabulary.add(t);
    addSurfaceForms(p.doc.title, surface);
  }
  const tokens = originalTokens.map((t) => correctToken(t, vocabulary));
  const corrected = tokens.some((t, i) => t !== originalTokens[i]);
  const tokenSet = new Set(tokens);
  const joined = tokens.join(" ");

  // Catégories désignées par la requête, avec le nombre de termes de la
  // requête qui les désignent : pour « habits femme », Mode Femme (2 termes)
  // passe devant Mode Homme (1 terme).
  const categoryHits = new Map<string, number>();
  for (const c of CATEGORY_TERMS) {
    const hits = c.terms.filter((term) => termMatchesQuery(term, tokenSet, joined)).length;
    if (hits > 0) categoryHits.set(c.category, hits);
  }
  const inferredCategories = [...categoryHits.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category]) => category);

  // Familles de mots : pour chaque mot de la requête, les termes équivalents.
  const expansions = new Map<string, Term[]>();
  for (const token of tokens) {
    const related: Term[] = [];
    for (const concept of CONCEPT_TERMS) {
      if (concept.some((term) => termMatchesQuery(term, new Set([token]), joined))) {
        related.push(...concept);
      }
    }
    expansions.set(token, related);
  }

  let hasDirectMatch = false;
  const results: { doc: SearchDoc; score: number }[] = [];

  for (const p of prepared) {
    let score = 0;
    let matched = 0;

    for (const token of tokens) {
      let best = 0;
      if (p.titleSet.has(token)) best = 10;
      else if (token.length >= 3 && p.titleTokens.some((t) => t.startsWith(token))) best = 7;

      if (best < 6) {
        for (const term of expansions.get(token) ?? []) {
          const inTitle = "single" in term ? p.titleSet.has(term.single) : ` ${p.titleJoined} `.includes(` ${term.phrase} `);
          if (inTitle) {
            best = Math.max(best, 6);
            break;
          }
        }
      }
      if (best < 5) {
        const tolerance = typoTolerance(token);
        if (tolerance > 0 && p.titleTokens.some((t) => boundedLevenshtein(t, token, tolerance) <= tolerance)) {
          best = 5;
        }
      }
      if (best < 4 && p.detailSet.has(token)) best = 4;
      if (best < 3) {
        for (const term of expansions.get(token) ?? []) {
          const inDetails = "single" in term ? p.detailSet.has(term.single) : ` ${p.detailJoined} `.includes(` ${term.phrase} `);
          if (inDetails) {
            best = 3;
            break;
          }
        }
      }

      if (best > 0) matched++;
      score += best;
    }

    if (tokens.length > 1 && matched === tokens.length) score += 5;
    if (tokens.length > 1 && ` ${p.titleJoined} `.includes(` ${joined} `)) score += 8;
    if (p.doc.category) score += 4 * Math.min(categoryHits.get(p.doc.category) ?? 0, 2);

    if (score >= 4) {
      results.push({ doc: p.doc, score });
      if (matched > 0) hasDirectMatch = true;
    }
  }

  results.sort((a, b) => b.score - a.score || b.doc.createdAt.localeCompare(a.doc.createdAt));

  return {
    results,
    inferredCategories,
    correctedQuery: corrected ? tokens.map((t) => surface.get(t) ?? t).join(" ") : null,
    hasDirectMatch,
  };
}
