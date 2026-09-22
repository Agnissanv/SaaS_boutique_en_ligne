/**
 * Table de correspondance nom de couleur -> code hexadécimal, ajoutée le
 * 22/09/2026 (refonte de la fiche produit boutique, inspirée de captures de
 * référence d'Isaac montrant de vraies pastilles de couleur). Les valeurs
 * de variante "Couleur" sont du texte libre tapé par le vendeur (ex.
 * "Rouge", "Bleu nuit") — aucune couleur exacte n'est enregistrée en base.
 *
 * Décision retenue avec Isaac (22/09/2026) : une table de correspondance
 * automatique pour les noms courants, sans rien changer au formulaire
 * vendeur ni à la base. Un nom non reconnu (nom de collection, faute de
 * frappe...) reste affiché en étiquette texte — voir son utilisation dans
 * `add-to-cart-form.tsx` (`getColorSwatch` renvoie `null` -> repli texte).
 * Ne jamais deviner une couleur approximative pour un nom non reconnu.
 */
const COLOR_HEX: Record<string, string> = {
  rouge: "#c1392b",
  bordeaux: "#6d1f2b",
  rose: "#e58aa5",
  fuchsia: "#c2266b",
  orange: "#d9772e",
  jaune: "#e8c547",
  moutarde: "#c9a227",
  vert: "#2f7d4f",
  "vert kaki": "#6b6b3a",
  kaki: "#6b6b3a",
  olive: "#6b6b1f",
  emeraude: "#0e6b4a",
  bleu: "#3465a4",
  "bleu marine": "#1b2a4a",
  "bleu nuit": "#1b2a4a",
  "bleu ciel": "#7fb2df",
  "bleu clair": "#7fb2df",
  turquoise: "#2ab7ac",
  indigo: "#3f3d99",
  violet: "#6a4c9c",
  mauve: "#8d7b9e",
  marron: "#5b3a29",
  camel: "#b08b5a",
  chocolat: "#4a2e1e",
  beige: "#d9c7a3",
  creme: "#f0e6d2",
  ivoire: "#f3ead8",
  taupe: "#8a7f72",
  gris: "#8c8c8c",
  "gris clair": "#c4c4c4",
  "gris fonce": "#4d4d4d",
  anthracite: "#3a3a3a",
  noir: "#16211c",
  blanc: "#ffffff",
  argent: "#c4c4c4",
  argente: "#c4c4c4",
  or: "#c9a227",
  dore: "#c9a227",
  corail: "#e8785a",
  saumon: "#e69a8d",
  lavande: "#b6a6d9",
};

function normalize(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Renvoie le code hex correspondant à un nom de couleur courant (français),
 * ou `null` si le nom n'est pas reconnu. L'appelant doit alors revenir à un
 * affichage texte plutôt que d'inventer une couleur.
 */
export function getColorSwatch(name: string): string | null {
  return COLOR_HEX[normalize(name)] ?? null;
}

/**
 * `true` si ce nom de groupe de variante désigne une couleur — sert à
 * décider d'afficher des pastilles plutôt que des puces texte dans
 * `add-to-cart-form.tsx`. Les groupes sont nommés librement par le vendeur
 * (`variant.name`), d'où la comparaison insensible à la casse/aux accents
 * plutôt qu'une valeur figée.
 */
export function isColorGroupName(name: string): boolean {
  const n = normalize(name);
  return n === "couleur" || n === "color" || n === "colour";
}
