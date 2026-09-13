/**
 * Génère un slug URL-friendly à partir d'un nom de boutique ou produit.
 * Ex: "Chez Awa Mode & Beauté !" -> "chez-awa-mode-beaute"
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // retire les accents (diacritiques combinants)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
