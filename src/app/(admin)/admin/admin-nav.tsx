"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardIcon,
  CoinsIcon,
  GridIcon,
  MailIcon,
  PackageIcon,
  StorefrontIcon,
  TagIcon,
  TicketIcon,
} from "@/components/admin/admin-icons";

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
  { href: "/admin/commandes", label: "Commandes", icon: PackageIcon },
  { href: "/admin/abonnements", label: "Abonnements", icon: TicketIcon },
  { href: "/admin/paiements", label: "Paiements", icon: CoinsIcon },
  { href: "/admin/codes-promo", label: "Codes promo", icon: TagIcon },
  { href: "/admin/messages", label: "Messages", icon: MailIcon },
  { href: "/admin/transactions", label: "Transactions", icon: ClipboardIcon },
];

/**
 * Navigation du back-office admin — passée en sidebar verticale le
 * 22/09/2026, à la demande d'Isaac : "vu qu'on a ajouté beaucoup de choses
 * sur la nav, il faudrait qu'on change de disposition [...] une sidebar bien
 * correcte", en écho au dashboard vendeur (`SidebarNav`, 15/09/2026). La
 * barre horizontale du 15/09 (4 liens à l'origine) est devenue intenable une
 * fois montée à 8 entrées (Commandes/Paiements/Codes promo/Messages ajoutés
 * le 22/09) — même symptôme que ce qui avait déjà forcé le passage en tiroir
 * sur mobile.
 *
 * Reprend le composant tel quel dans `<aside>` (voir layout.tsx) plutôt
 * qu'un nouveau fichier séparé — `NAV_ITEMS` reste exporté d'ici pour
 * `admin-mobile-nav.tsx`, qui n'a pas changé (son tiroir affichait déjà
 * cette liste verticalement, seul le déclencheur change de place — voir
 * layout.tsx).
 */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
      {NAV_ITEMS.map((item) => {
        // `.startsWith` en plus de l'égalité stricte depuis le 22/09/2026 :
        // la fiche détaillée d'un vendeur (/admin/vendeurs/[slug]) doit
        // toujours surligner "Vendeurs", pas rester sans lien actif.
        //
        // **Bug corrigé le 22/09/2026** (repéré par Isaac : "deux boutons
        // comme si les deux avaient la classe active") : cette règle
        // s'appliquait aussi à "/admin" (Vue d'ensemble) — `.startsWith`
        // avec un préfixe vide après le premier segment fait que TOUTE
        // page admin (/admin/commandes, /admin/vendeurs, etc.) commence par
        // "/admin/", donc "Vue d'ensemble" restait allumée partout en plus
        // de la page réellement active. Exclu explicitement : "/admin" ne
        // fait jamais de correspondance par préfixe, seulement l'égalité
        // stricte (c'est la page d'accueil admin, pas un préfixe de route).
        const active =
          pathname === item.href ||
          (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
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
        );
      })}
    </nav>
  );
}
