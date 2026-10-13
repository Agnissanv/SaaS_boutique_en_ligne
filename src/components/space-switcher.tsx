"use client";

import Link from "next/link";

export const SPACE_COOKIE = "keva_espace";

function rememberSpace(space: "boutique" | "partenaire") {
  document.cookie = `${SPACE_COOKIE}=${space}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax`;
}

/**
 * Sélecteur « Ma boutique | Partenaire » (13/10/2026, programme partenaire) :
 * une partenaire a un seul compte et deux espaces, chacun avec son propre
 * menu (demande d'Isaac : « dès qu'elle clique sur une page, ça ouvre toutes
 * les fonctionnalités de la page en question »). Visible uniquement pour les
 * comptes partenaires, en haut de la sidebar sur ordinateur et de l'écran
 * sur téléphone. Mémorise le dernier espace choisi : c'est là qu'elle arrive
 * à sa prochaine connexion (voir `resolveHomePath`).
 */
export function SpaceSwitcher({
  active,
  tone = "dark",
}: {
  active: "boutique" | "partenaire";
  tone?: "dark" | "light";
}) {
  const track = tone === "dark" ? "bg-white/10" : "bg-brume";
  const idle = tone === "dark" ? "text-ivoire/70 hover:text-ivoire" : "text-encre/60 hover:text-encre";
  const current = tone === "dark" ? "bg-ivoire text-vert-sapin" : "bg-white text-vert-sapin shadow-sm";

  const items = [
    { space: "boutique" as const, href: "/dashboard", label: "Ma boutique" },
    { space: "partenaire" as const, href: "/partenaire", label: "Partenaire" },
  ];

  return (
    <nav aria-label="Changer d'espace" className={`grid grid-cols-2 gap-1 rounded-full p-1 ${track}`}>
      {items.map((item) => (
        <Link
          key={item.space}
          href={item.href}
          onClick={() => rememberSpace(item.space)}
          aria-current={active === item.space ? "page" : undefined}
          className={`rounded-full px-3 py-1.5 text-center text-xs font-semibold transition-colors ${
            active === item.space ? current : idle
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
