"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.ReactElement;
  /**
   * Masqué pour un collaborateur (plan Pro, `can_multi_user`, ajouté le
   * 16/09/2026) — réglages boutique, codes promo, gestion des
   * collaborateurs, paiements et abonnement restent réservés au
   * propriétaire. Voir src/lib/shop-access.ts pour le raisonnement complet.
   */
  ownerOnly?: boolean;
  /**
   * Préfixes de route supplémentaires qui comptent comme "actif" pour ce
   * lien — ajouté le 30/09/2026 pour "Paramètres" : son `href` pointe vers
   * `/dashboard/profil` (seule page accessible à tout le monde), mais le
   * lien doit aussi rester surligné sur les autres onglets de l'espace
   * Paramètres (Sécurité, Boutique, Notifications, Paiements, Abonnement,
   * Collaborateurs — voir settings-tabs.tsx).
   */
  activePrefixes?: string[];
};
type NavSection = { label?: string; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { href: "/dashboard", label: "Aperçu", icon: IconGrid },
      { href: "/dashboard/produits", label: "Produits", icon: IconBox },
      { href: "/dashboard/commandes", label: "Commandes", icon: IconReceipt },
      { href: "/dashboard/paniers-abandonnes", label: "Paniers abandonnés", icon: IconCartAlert },
      { href: "/dashboard/statistiques", label: "Statistiques", icon: IconChart },
      { href: "/dashboard/avis", label: "Avis", icon: IconStar },
    ],
  },
  {
    items: [
      { href: "/dashboard/codes-promo", label: "Codes promo", icon: IconTag, ownerOnly: true },
      { href: "/dashboard/parrainage", label: "Parrainage", icon: IconGift, ownerOnly: true },
    ],
  },
  {
    items: [
      // Un seul lien vers l'espace Paramètres à onglets (Profil, Sécurité,
      // Boutique, Notifications, Paiements, Abonnement, Collaborateurs — voir
      // settings-tabs.tsx) plutôt que les 5 liens séparés d'avant le
      // 30/09/2026 ("sidebar désordonnée et trop affichée", retour d'Isaac) :
      // pointe vers Profil, la seule page accessible à tout le monde
      // (propriétaire ET collaborateur), pas vers une page réservée au
      // propriétaire.
      {
        href: "/dashboard/profil",
        label: "Paramètres",
        icon: IconSettings,
        activePrefixes: [
          "/dashboard/parametres",
          "/dashboard/boutique",
          "/dashboard/paiements",
          "/dashboard/abonnement",
          "/dashboard/collaborateurs",
        ],
      },
      { href: "/dashboard/aide", label: "Aide", icon: IconHelp },
    ],
  },
];

/**
 * Navigation de la sidebar dashboard vendeur — extraite en Client Component
 * le 15/09/2026 (refonte de layout.tsx, sur inspiration d'une maquette
 * envoyée par le designer UX/UI d'Isaac) uniquement pour pouvoir lire
 * `usePathname()` et surligner le lien actif — le reste du layout parent
 * reste un Server Component (accès direct à Supabase pour shop/profil/
 * abonnement).
 *
 * `isOwner` (ajouté le 16/09/2026, multi-utilisateurs plan Pro) : un
 * collaborateur ne voit pas les entrées `ownerOnly` — calculé une seule
 * fois dans layout.tsx via src/lib/shop-access.ts et transmis ici.
 */
export function SidebarNav({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {NAV_SECTIONS.map((section, i) => {
        const items = section.items.filter((item) => !item.ownerOnly || isOwner);
        if (items.length === 0) return null;

        return (
          <div key={i}>
            {section.label && (
              <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-ivoire/45">
                {section.label}
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => {
                const active =
                  pathname === item.href ||
                  Boolean(item.activePrefixes?.some((prefix) => pathname.startsWith(prefix)));
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                        active
                          ? "bg-white/10 font-medium text-ivoire"
                          : "text-ivoire/70 hover:bg-white/5 hover:text-ivoire"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function IconGrid(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}

function IconBox(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 8l9-5 9 5-9 5-9-5Z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  );
}

function IconReceipt(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  );
}

/** Ajoutée le 16/09/2026 pour "Statistiques" (plan Business+, has_advanced_stats). */
/** Ajoutée le 23/09/2026 pour "Paniers abandonnés" (Business+, voir migration 0044). */
function IconCartAlert(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 4h2l2.2 11.4a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L20.5 8H6" />
      <circle cx="9.5" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
      <path d="M17 3.5v4M15 5.5h4" />
    </svg>
  );
}

function IconChart(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 20V10M12 20V4M20 20v-7" />
      <path d="M3 20h18" />
    </svg>
  );
}

function IconStar(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.1 6.1-.6L12 3Z" />
    </svg>
  );
}

/** Ajoutée le 23/09/2026 pour "Parrainage" (système de parrainage vendeur). */
function IconGift(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="9" width="18" height="4" rx="1" />
      <rect x="5" y="13" width="14" height="8" rx="1" />
      <path d="M12 9v12" />
      <path d="M12 9c-1.2-3-3-4.5-4.5-4.5A2 2 0 0 0 5.5 6.5C5.5 8 7.5 9 12 9Z" />
      <path d="M12 9c1.2-3 3-4.5 4.5-4.5a2 2 0 0 1 2 2c0 1.5-2 2.5-6.5 2.5Z" />
    </svg>
  );
}

/** Ajoutée le 16/09/2026 pour "Codes promo" (plan Pro, can_use_promo_codes). */
function IconTag(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12.5 3.5h5a2 2 0 0 1 2 2v5a2 2 0 0 1-.6 1.4l-8 8a2 2 0 0 1-2.8 0l-5-5a2 2 0 0 1 0-2.8l8-8a2 2 0 0 1 1.4-.6Z" />
      <circle cx="16.5" cy="7.5" r="1.25" />
    </svg>
  );
}

/**
 * Ajoutée le 30/09/2026 pour "Paramètres" (regroupe Profil, Sécurité,
 * Boutique, Notifications, Paiements, Abonnement, Collaborateurs — refonte
 * de la sidebar, voir settings-tabs.tsx). Remplace les icônes dédiées
 * (Boutique, Paiements, Abonnement, Collaborateurs, Profil) qui vivaient
 * jusqu'ici dans ce fichier, retirées puisque ces liens ne sont plus dans la
 * sidebar elle-même.
 */
function IconSettings(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.6V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a1.7 1.7 0 0 0 1.6 1h.2a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1Z" />
    </svg>
  );
}

function IconHelp(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.2a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.5" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
