/**
 * Badge "Boutique vérifiée" — ajouté le 22/09/2026 (audit croissance,
 * décision d'Isaac : donner un signal de confiance visible aux boutiques
 * Business+/Pro, sans jamais le vendre séparément — voir migration 0042 et
 * `ShopFeatureFlags.hasVerifiedBadge`, subscription.ts). Rendu partout où le
 * nom d'une boutique apparaît côté marketplace : carte produit, carte
 * boutique, en-tête de la fiche boutique publique — un seul composant
 * partagé pour que le badge reste identique partout.
 *
 * Icône dessinée à la main (même parti pris que les icônes du hero et de la
 * sidebar vendeur, 15/09/2026 : pas de dépendance à une librairie d'icônes)
 * — un simple disque plein avec un chevron, plutôt qu'un contour dentelé
 * (façon médaille) qui aurait été plus difficile à lire en petite taille
 * dans une carte produit.
 */
export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`inline-block h-3.5 w-3.5 shrink-0 ${className ?? ""}`}
      role="img"
      aria-label="Boutique vérifiée"
    >
      <title>Boutique vérifiée</title>
      <circle cx="10" cy="10" r="9" className="fill-vert-actif" />
      <path
        d="M6.2 10.3l2.4 2.4 5.2-5.2"
        fill="none"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
