"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type SettingsTab = {
  href: string;
  label: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.ReactElement;
  /** Réservé au propriétaire — même périmètre que `ownerOnly` sur `sidebar-nav.tsx`. */
  ownerOnly?: boolean;
};

const SETTINGS_TABS: SettingsTab[] = [
  { href: "/dashboard/profil", label: "Profil", icon: IconUser },
  { href: "/dashboard/parametres/securite", label: "Sécurité", icon: IconLock },
  { href: "/dashboard/boutique", label: "Boutique", icon: IconStorefront, ownerOnly: true },
  { href: "/dashboard/parametres/notifications", label: "Notifications", icon: IconBell, ownerOnly: true },
  { href: "/dashboard/paiements", label: "Paiements", icon: IconWallet, ownerOnly: true },
  { href: "/dashboard/abonnement", label: "Abonnement", icon: IconBadge, ownerOnly: true },
  { href: "/dashboard/collaborateurs", label: "Collaborateurs", icon: IconUsers, ownerOnly: true },
];

/**
 * Barre d'onglets partagée par toutes les pages "Paramètres" — ajoutée le
 * 30/09/2026, refonte inspirée d'une maquette générique ("Lumina Store")
 * qu'Isaac a envoyée. Décision prise avec lui (AskUserQuestion) : regrouper
 * Profil, Boutique, Paiements, Abonnement et Collaborateurs sous un même
 * espace "Paramètres", plus deux nouveaux onglets (Sécurité, Notifications).
 *
 * Volontairement PAS un vrai regroupement de routes sous `/dashboard/
 * parametres/*` : Profil/Boutique/Paiements/Abonnement/Collaborateurs
 * gardent leurs URLs actuelles (`/dashboard/profil`, `/dashboard/boutique`,
 * etc.) — les déplacer aurait exigé de mettre à jour des dizaines de
 * `redirect()`/liens dans tout le dashboard (chaque page redirige vers
 * `/dashboard/boutique` quand la boutique n'existe pas encore) pour un
 * bénéfice purement cosmétique. Seuls les deux onglets VRAIMENT nouveaux
 * (Sécurité, Notifications) vivent sous `/dashboard/parametres/*`, sans
 * rien à casser puisqu'ils n'existaient pas avant. Cette barre est ce qui
 * donne l'impression d'un espace "Paramètres" unifié, quelle que soit l'URL
 * réelle de chaque onglet.
 *
 * `isOwner` — même raisonnement que `SidebarNav` : un collaborateur (plan
 * Pro) ne voit pas les onglets réservés au propriétaire, qui restent de
 * toute façon protégés côté page par un lookup `owner_id` direct.
 */
export function SettingsTabs({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  const tabs = SETTINGS_TABS.filter((tab) => !tab.ownerOnly || isOwner);

  return (
    <div className="mt-4 flex flex-wrap gap-1.5 border-b border-ligne pb-4">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active ? "bg-vert-actif/10 text-vert-sapin" : "text-encre/60 hover:bg-brume"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
          </Link>
        );
      })}
    </div>
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

function IconLock(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
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

function IconBell(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
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
