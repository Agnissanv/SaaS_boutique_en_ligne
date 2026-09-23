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
    label: "Boutique",
    items: [
      { href: "/dashboard/boutique", label: "Ma boutique", icon: IconStorefront, ownerOnly: true },
      { href: "/dashboard/codes-promo", label: "Codes promo", icon: IconTag, ownerOnly: true },
      { href: "/dashboard/collaborateurs", label: "Collaborateurs", icon: IconUsers, ownerOnly: true },
      { href: "/dashboard/paiements", label: "Paiements", icon: IconWallet, ownerOnly: true },
      { href: "/dashboard/abonnement", label: "Abonnement", icon: IconBadge, ownerOnly: true },
    ],
  },
  {
    label: "Compte",
    items: [
      { href: "/dashboard/profil", label: "Profil", icon: IconUser },
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
                const active = pathname === item.href;
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

function IconStorefront(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 9l1-5h14l1 5" />
      <path d="M4 9a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" />
      <path d="M5 9v10h14V9" />
      <path d="M10 19v-5h4v5" />
    </svg>
  );
}

function IconWallet(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="7" width="18" height="12" rx="2" />
      <path d="M3 9h13a2 2 0 0 0 2-2" />
      <path d="M16 13h2" />
    </svg>
  );
}

function IconBadge(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="9" r="6" />
      <path d="M8.5 14.5 7 21l5-2.5 5 2.5-1.5-6.5" />
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

/** Ajoutée le 16/09/2026 pour "Collaborateurs" (plan Pro, can_multi_user). */
function IconUsers(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5" />
      <circle cx="17" cy="8.5" r="2.3" />
      <path d="M15.7 14.7c2.4.5 4.3 2.5 4.3 5.3" />
    </svg>
  );
}

function IconUser(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
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
