"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/partenaire", label: "Résultats" },
  { href: "/partenaire/liens", label: "Liens et code" },
  { href: "/partenaire/paiements", label: "Paiements" },
  { href: "/partenaire/reglages", label: "Réglages" },
];

/**
 * Menu de l'espace partenaire : volontairement court (4 entrées, demande
 * d'Isaac : « faudrait pas que ça soit trop rempli »). Colonne dans la
 * sidebar sur ordinateur, barre d'onglets défilante sur téléphone.
 */
export function PartnerNav({ variant }: { variant: "sidebar" | "tabs" }) {
  const pathname = usePathname();

  if (variant === "tabs") {
    return (
      <nav aria-label="Espace partenaire" className="flex gap-1 overflow-x-auto border-b border-ligne bg-white px-3">
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 border-b-2 px-3 py-2.5 text-sm ${
                active ? "border-vert-actif font-medium text-vert-sapin" : "border-transparent text-encre/60"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Espace partenaire" className="flex flex-1 flex-col gap-0.5 px-3 py-4">
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-2 text-sm transition-colors ${
              active ? "bg-white/10 font-medium text-ivoire" : "text-ivoire/70 hover:bg-white/5 hover:text-ivoire"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
