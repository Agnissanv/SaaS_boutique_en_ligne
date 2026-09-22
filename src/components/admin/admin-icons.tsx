/**
 * Icônes admin — dessinées à la main en SVG inline, mêmes conventions que le
 * reste du projet (`CategoryIcon`, sidebar du dashboard vendeur, argumentaire
 * de confiance de la page d'accueil) : pas de dépendance à une librairie
 * d'icônes, `viewBox 0 0 20 20`, `stroke="currentColor"`.
 *
 * Ajoutées le 15/09/2026 en reprenant le back-office admin (`(admin)/admin`)
 * pour qu'il suive la même direction artistique que le dashboard vendeur —
 * Isaac avait raison de trouver le premier passage (recolorage pur, sans
 * aucune icône) trop plat comparé au reste du produit.
 */
const baseProps = {
  viewBox: "0 0 20 20",
  fill: "none" as const,
  stroke: "currentColor" as const,
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function GridIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg {...baseProps} className={className}>
      <rect x="2.8" y="2.8" width="6" height="6" rx="1.2" />
      <rect x="11.2" y="2.8" width="6" height="6" rx="1.2" />
      <rect x="2.8" y="11.2" width="6" height="6" rx="1.2" />
      <rect x="11.2" y="11.2" width="6" height="6" rx="1.2" />
    </svg>
  );
}

export function StorefrontIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M3 8.5 4 3.5h12l1 5" />
      <path d="M3 8.5a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0" />
      <path d="M4 8.8V16h12V8.8" />
      <path d="M8.3 16v-4.2a1.7 1.7 0 0 1 3.4 0V16" />
    </svg>
  );
}

export function CheckCircleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg {...baseProps} className={className}>
      <circle cx="10" cy="10" r="7" />
      <path d="M7 10.2l2 2 4-4.4" />
    </svg>
  );
}

export function PauseCircleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg {...baseProps} className={className}>
      <circle cx="10" cy="10" r="7" />
      <path d="M8.3 7.3v5.4M11.7 7.3v5.4" />
    </svg>
  );
}

export function TicketIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M3 8a1.6 1.6 0 0 0 0-3V4.2A1.2 1.2 0 0 1 4.2 3h11.6A1.2 1.2 0 0 1 17 4.2V5a1.6 1.6 0 0 0 0 3 1.6 1.6 0 0 0 0 3v.8a1.2 1.2 0 0 1-1.2 1.2H4.2A1.2 1.2 0 0 1 3 11.8V11a1.6 1.6 0 0 0 0-3Z" />
      <path d="M10 3v11" strokeDasharray="1.6 1.6" />
    </svg>
  );
}

export function CoinsIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg {...baseProps} className={className}>
      <ellipse cx="7.5" cy="6" rx="4.5" ry="2.3" />
      <path d="M3 6v4c0 1.27 2.01 2.3 4.5 2.3S12 11.27 12 10V6" />
      <path d="M9.5 10.4c.35 1.1 2.15 1.9 4 1.9 2.49 0 4.5-1.03 4.5-2.3v-4" />
      <ellipse cx="13.5" cy="8" rx="4.5" ry="2.3" />
    </svg>
  );
}

export function TagIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M11 3h4.2A1 1 0 0 1 16 3.8V8l-8 8-5-5Z" />
      <circle cx="13.2" cy="5.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SearchIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg {...baseProps} className={className}>
      <circle cx="8.7" cy="8.7" r="5.2" />
      <path d="M16 16l-3.5-3.5" />
    </svg>
  );
}

export function MailIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg {...baseProps} className={className}>
      <rect x="2.8" y="4.5" width="14.4" height="11" rx="1.4" />
      <path d="M3.3 5.3 10 11l6.7-5.7" />
    </svg>
  );
}

export function PackageIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M10 3 3 6.5v7L10 17l7-3.5v-7Z" />
      <path d="M3 6.5 10 10l7-3.5" />
      <path d="M10 10v7" />
    </svg>
  );
}

export function ClipboardIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg {...baseProps} className={className}>
      <rect x="4.5" y="3.5" width="11" height="14" rx="1.4" />
      <rect x="7.3" y="2.2" width="5.4" height="2.6" rx="0.8" />
      <path d="M7 9h6M7 12h6M7 15h3.5" />
    </svg>
  );
}
