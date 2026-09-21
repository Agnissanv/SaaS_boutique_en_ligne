"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardIcon, GridIcon, StorefrontIcon, TicketIcon } from "@/components/admin/admin-icons";

type NavItem = {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.ReactElement;
};

/**
 * Exportée depuis le 21/09/2026 (nav mobile admin, voir `admin-mobile-nav.tsx`)
 * pour que le tiroir mobile réutilise exactement la même liste que la barre
 * horizontale desktop — un seul endroit à mettre à jour si un lien admin
 * change un jour, comme `SidebarNav`/`MobileNavDrawer` côté vendeur.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Vue d'ensemble", icon: GridIcon },
  { href: "/admin/vendeurs", label: "Vendeurs", icon: StorefrontIcon },
  { href: "/admin/abonnements", label: "Abonnements", icon: TicketIcon },
  { href: "/admin/transactions", label: "Transactions", icon: ClipboardIcon },
];

/**
 * Navigation du back-office admin — extraite en Client Component le
 * 15/09/2026 (second passage visuel sur l'admin) uniquement pour lire
 * `usePathname()` et surligner le lien actif, même raison que `SidebarNav`
 * côté dashboard vendeur. Reste une barre horizontale (4 liens seulement,
 * pas besoin d'une sidebar verticale comme le vendeur) mais reprend le même
 * traitement pill/icône + état actif que le reste de la direction
 * artistique KEVA.
 *
 * **Masquée sous `sm` depuis le 21/09/2026** (voir `admin-mobile-nav.tsx`) :
 * avec `flex-wrap`, cette barre mélangeait jusqu'ici logo, les 4 liens et le
 * bouton de déconnexion sur la même ligne, qui retombaient en plusieurs
 * lignes désordonnées dès que ça ne tenait plus ("vraiment dégueulasse" sur
 * mobile, signalé par Isaac) — remplacée en dessous de `sm` par un tiroir,
 * même schéma que le dashboard vendeur.
 */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <div className="hidden items-center gap-1 sm:flex">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
              active
                ? "bg-white/10 font-medium text-ivoire"
                : "text-ivoire/70 hover:bg-white/5 hover:text-ivoire"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
