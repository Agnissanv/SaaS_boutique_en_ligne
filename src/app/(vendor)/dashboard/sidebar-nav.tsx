"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; icon: (props: React.SVGProps<SVGSVGElement>) => React.ReactElement };
type NavSection = { label?: string; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { href: "/dashboard", label: "Aperçu", icon: IconGrid },
      { href: "/dashboard/produits", label: "Produits", icon: IconBox },
      { href: "/dashboard/commandes", label: "Commandes", icon: IconReceipt },
      { href: "/dashboard/avis", label: "Avis", icon: IconStar },
    ],
  },
  {
    label: "Boutique",
    items: [
      { href: "/dashboard/boutique", label: "Ma boutique", icon: IconStorefront },
      { href: "/dashboard/paiements", label: "Paiements", icon: IconWallet },
      { href: "/dashboard/abonnement", label: "Abonnement", icon: IconBadge },
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
 */
export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {NAV_SECTIONS.map((section, i) => (
        <div key={i}>
          {section.label && (
            <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-ivoire/45">
              {section.label}
            </p>
          )}
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
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
      ))}
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
