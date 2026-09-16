/**
 * Tronque un texte à `max` caractères, en coupant sur le dernier espace
 * avant la limite plutôt qu'en plein milieu d'un mot — ajouté le 16/09/2026
 * pour les meta descriptions (boutique/produit, voir `generateMetadata` dans
 * les pages publiques) : une description vendeur ou produit peut dépasser
 * largement la longueur utile pour un aperçu de partage WhatsApp/réseaux
 * sociaux (~155-160 caractères avant troncature par la plupart des clients).
 */
export function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`;
}
