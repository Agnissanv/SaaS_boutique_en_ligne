/**
 * Outils texte du moteur de recherche (09/10/2026).
 *
 * Tout le moteur compare des formes NORMALISÉES : minuscules, sans accents,
 * sans ponctuation, pluriels et féminins ramenés à une même racine. « Clé
 * USB », « cle usb » et « CLÉS USB » donnent ainsi exactement les mêmes
 * jetons, côté requête comme côté produit.
 */

// Toutes les marques diacritiques (accents, cédilles...) après décomposition NFD.
const COMBINING_MARKS = /\p{M}/gu;

/** Minuscules, sans accents ni ponctuation, espaces simples. */
export function normalizeText(input: string): string {
  return input
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Mots trop courants pour aider à trouver un article. Formes normalisées.
const STOPWORDS = new Set([
  "a", "au", "aux", "avec", "ce", "ces", "cet", "cette", "d", "dans", "de", "des", "du",
  "en", "et", "l", "la", "le", "les", "ma", "mes", "mon", "ou", "par", "pour", "qui",
  "que", "sans", "sur", "ta", "tes", "ton", "un", "une", "je", "cherche", "veux",
  "besoin", "acheter", "achat", "the", "of", "for", "and", "y", "plus", "tres",
]);

/**
 * Racine « légère » d'un mot français : pluriels (-s, -x, -eaux, -aux) et
 * -e final retirés. Volontairement simple — l'important est d'appliquer la
 * MÊME transformation à la requête et aux produits, pas d'être exact
 * linguistiquement (« chemise » et « chemises » donnent toutes deux « chemis »).
 */
export function stem(word: string): string {
  if (word.length <= 3 || /^\d+$/.test(word)) return word;
  let w = word;
  if (w.endsWith("eaux")) w = w.slice(0, -1);
  else if (w.endsWith("aux") && w.length > 5) w = w.slice(0, -3) + "al";
  else if (w.endsWith("s") || w.endsWith("x")) w = w.slice(0, -1);
  if (w.length > 4 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

/** Jetons normalisés + racinisés, sans mots vides ni doublons. */
export function tokenize(input: string): string[] {
  const seen = new Set<string>();
  for (const raw of normalizeText(input).split(" ")) {
    if (!raw || STOPWORDS.has(raw)) continue;
    seen.add(stem(raw));
  }
  return [...seen];
}

/**
 * Distance de Levenshtein, interrompue dès qu'elle dépasse `max` (renvoie
 * alors `max + 1`) : on ne s'en sert que pour de petites fautes de frappe.
 */
export function boundedLevenshtein(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      current.push(value);
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    previous = current;
  }
  return previous[b.length];
}

/** Nombre de fautes tolérées selon la longueur du mot. */
export function typoTolerance(word: string): number {
  if (word.length >= 8) return 2;
  if (word.length >= 4) return 1;
  return 0;
}
