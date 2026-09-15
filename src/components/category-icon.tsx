/**
 * Icônes de catégorie — dessinées à la main en SVG inline, ajoutées le
 * 15/09/2026 en même temps que l'extension de `CATEGORIES` (6 → 24, voir
 * `src/lib/categories.ts`). Même parti pris que les autres icônes du projet
 * (argumentaire de confiance de la page d'accueil, sidebar du dashboard
 * vendeur) : pas de dépendance à une librairie d'icônes.
 *
 * Nécessaire, pas seulement cosmétique : avec 24 catégories, la pastille à
 * l'initiale utilisée jusqu'ici (une seule lettre) commence à produire de
 * vraies collisions visuelles (Mode / Mode Femme / Mode Homme / Mode Enfant
 * / Maison partagent toutes un M, Bijoux / Beauté / Bébé / Bricolage &
 * Jardin partagent un B) — remplacée ici par une icône distincte par
 * catégorie plutôt qu'une lettre.
 *
 * `value` accepte `"all"` (tuile "Toutes" de `CategoryNav`, pas une vraie
 * valeur de `CATEGORIES`) en plus des valeurs de catégorie ; toute valeur
 * non reconnue retombe sur l'icône générique d'`autre` plutôt que de casser
 * le rendu — utile si une catégorie est un jour retirée de la liste sans
 * que d'anciens produits soient migrés.
 */
export function CategoryIcon({ value, className = "h-5 w-5" }: { value: string; className?: string }) {
  const props = {
    viewBox: "0 0 20 20",
    fill: "none" as const,
    stroke: "currentColor" as const,
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };

  switch (value) {
    case "all":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="6" height="6" rx="1.2" />
          <rect x="11" y="3" width="6" height="6" rx="1.2" />
          <rect x="3" y="11" width="6" height="6" rx="1.2" />
          <rect x="11" y="11" width="6" height="6" rx="1.2" />
        </svg>
      );
    case "mode":
      return (
        <svg {...props}>
          <path d="M10 4a1.3 1.3 0 1 1 1.4 1.3" />
          <path d="M10 5.3 3 10.6c-.6.5-.2 1.5.6 1.5h12.8c.8 0 1.2-1 .6-1.5L10 5.3Z" />
          <path d="M4.5 15.5h11" />
        </svg>
      );
    case "mode_femme":
      return (
        <svg {...props}>
          <path d="M8 3h4l1 2.8-1.6 1.1L13.2 16a1 1 0 0 1-1 1.1H7.8a1 1 0 0 1-1-1.1L8.6 6.9 7 5.8 8 3Z" />
        </svg>
      );
    case "mode_homme":
      return (
        <svg {...props}>
          <path d="M7 3 4.2 5v3l2-.7V16.5h7.6V7.3l2 .7V5L13 3l-1.5 1.5h-3L7 3Z" />
        </svg>
      );
    case "mode_enfant":
      return (
        <svg {...props}>
          <path d="M7.6 5 5.2 6.3v2l1.6-.5v6.7h6.4V7.8l1.6.5v-2L12.4 5l-1 1h-2.8l-1-1Z" />
          <circle cx="10" cy="10.3" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      );
    case "chaussures":
      return (
        <svg {...props}>
          <path d="M3 13.3V9.7c0-.4.3-.8.7-1L9 6.4c.4-.2.9-.1 1.2.2l1 1c.3.3.7.5 1.1.5h2.1c.9 0 1.7.6 2 1.4l.6 1.8H3.9" />
          <path d="M3 13.3h14v1.2H3z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "bijoux":
      return (
        <svg {...props}>
          <path d="M6 4h8l2.3 3.3L10 16.5 3.7 7.3 6 4Z" />
          <path d="M3.7 7.3h12.6M8 4l2 3.3 2-3.3" />
        </svg>
      );
    case "beaute":
      return (
        <svg {...props}>
          <rect x="7.3" y="7.8" width="5.4" height="8.7" rx="1.2" />
          <rect x="8.4" y="5.4" width="3.2" height="2.6" rx="0.5" />
          <path d="M9.1 3.5h1.8v2H9.1z" />
        </svg>
      );
    case "sante_bienetre":
      return (
        <svg {...props}>
          <path d="M10 16.3 4.2 10.9a3.4 3.4 0 0 1 4.7-4.9l1.1 1 1.1-1a3.4 3.4 0 0 1 4.7 4.9L10 16.3Z" />
          <path d="M10 8.2v3M8.5 9.7h3" />
        </svg>
      );
    case "electronique":
      return (
        <svg {...props}>
          <path d="M11 2.2 4.6 11.3h3.8l-.5 6.5 6.5-9.1h-3.8l.4-6.5Z" />
        </svg>
      );
    case "telephonie":
      return (
        <svg {...props}>
          <rect x="6" y="2.3" width="8" height="15.4" rx="1.6" />
          <path d="M9 15.3h2" />
        </svg>
      );
    case "informatique":
      return (
        <svg {...props}>
          <rect x="4" y="4" width="12" height="8" rx="1" />
          <path d="M2.3 15.7h15.4l-1.6-2.3H3.9l-1.6 2.3Z" />
        </svg>
      );
    case "electromenager":
      return (
        <svg {...props}>
          <rect x="3.6" y="2.8" width="12.8" height="14.4" rx="1.4" />
          <circle cx="10" cy="11" r="3.8" />
          <circle cx="6.1" cy="5" r="0.5" fill="currentColor" stroke="none" />
          <circle cx="8" cy="5" r="0.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "maison":
      return (
        <svg {...props}>
          <path d="M3 10 10 4l7 6" />
          <path d="M5 9v7.5h10V9" />
          <path d="M8.2 16.5v-4h3.6v4" />
        </svg>
      );
    case "decoration":
      return (
        <svg {...props}>
          <rect x="4" y="3" width="12" height="14" rx="1" />
          <path d="M4.6 12.5 8 9l2.5 2.3 2.8-3.3 3.1 4.2" />
          <circle cx="7.6" cy="6.8" r="1" />
        </svg>
      );
    case "cuisine":
      return (
        <svg {...props}>
          <path d="M4 9h12v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9Z" />
          <path d="M2.6 9h14.8" />
          <path d="M3.4 9V7.2M16.6 9V7.2" />
        </svg>
      );
    case "alimentation":
      return (
        <svg {...props}>
          <path d="M4 8h12l-1.2 7.4a1.5 1.5 0 0 1-1.5 1.3H6.7a1.5 1.5 0 0 1-1.5-1.3L4 8Z" />
          <path d="M2.5 8h15" />
          <path d="M7.2 8l1-4M12.8 8l-1-4" />
        </svg>
      );
    case "bebe":
      return (
        <svg {...props}>
          <rect x="7.4" y="6.2" width="5.2" height="10" rx="1.5" />
          <rect x="8.2" y="3.5" width="3.6" height="2.7" rx="0.6" />
          <path d="M7.4 9.6h5.2" />
        </svg>
      );
    case "jouets":
      return (
        <svg {...props}>
          <rect x="3" y="10" width="6" height="6" rx="1" />
          <rect x="11" y="10" width="6" height="6" rx="1" />
          <path d="M6 10V6.6A2.6 2.6 0 0 1 8.6 4h2.8A2.6 2.6 0 0 1 14 6.6V10" />
        </svg>
      );
    case "sport":
      return (
        <svg {...props}>
          <circle cx="10" cy="10" r="7" />
          <path d="M10 3v14M3 10h14M5.3 5.3c1.9 1.9 7.5 1.9 9.4 0M5.3 14.7c1.9-1.9 7.5-1.9 9.4 0" />
        </svg>
      );
    case "auto_moto":
      return (
        <svg {...props}>
          <path d="M3.3 12.6 4.8 8.3A1.5 1.5 0 0 1 6.2 7.3h7.6a1.5 1.5 0 0 1 1.4 1l1.5 4.3" />
          <rect x="2.5" y="12.6" width="15" height="3.4" rx="1" />
          <circle cx="6" cy="16.3" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="14" cy="16.3" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case "bricolage_jardin":
      return (
        <svg {...props}>
          <path d="M14.2 3.4a2.8 2.8 0 0 0-3.7 3.6L4.3 13.2l2.5 2.5 6.2-6.2a2.8 2.8 0 0 0 3.6-3.7l-1.9 1.9-1.9-.5-.5-1.9 1.9-1.9Z" />
        </svg>
      );
    case "papeterie":
      return (
        <svg {...props}>
          <path d="M4.2 15.8 5 12.2 13 4.2l2.8 2.8-8 8-3.6.8Z" />
          <path d="M11.3 5.9 14.1 8.7" />
        </svg>
      );
    case "livres":
      return (
        <svg {...props}>
          <path d="M4 4.3c2-1 4-1 6 .5v10.2c-2-1.5-4-1.5-6-.5V4.3Z" />
          <path d="M16 4.3c-2-1-4-1-6 .5v10.2c2-1.5 4-1.5 6-.5V4.3Z" />
        </svg>
      );
    case "autre":
    default:
      return (
        <svg {...props}>
          <path d="M11 3.4H5.6a1 1 0 0 0-1 1V9a1 1 0 0 0 .3.7l7 7a1 1 0 0 0 1.4 0l4-4a1 1 0 0 0 0-1.4l-7-7a1 1 0 0 0-.3-.9Z" />
          <circle cx="8" cy="7" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}
