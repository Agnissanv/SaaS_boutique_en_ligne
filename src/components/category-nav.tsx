import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import { buildMarketplaceHref, type MarketplaceFilters } from "@/lib/marketplace/filters";

/**
 * Bande de catégories façon Jumia (rangée de "tuiles" juste sous l'en-tête,
 * point d'entrée principal pour parcourir le catalogue) — ajoutée le
 * 13/09/2026 à la demande d'Isaac, qui a partagé la page d'accueil Jumia
 * comme inspiration de disposition (pas de couleurs/design à ce stade).
 * Remplace les petites pastilles de filtre qui étaient auparavant coincées
 * entre la barre de recherche et la grille — une seule rangée de catégories
 * sert maintenant à la fois de navigation ET de filtre (même lien, même
 * état actif), au lieu d'avoir deux UI de catégorie différentes sur la page.
 *
 * Les tuiles restent des blocs neutres avec juste une initiale : pas de
 * vraies icônes/illustrations par catégorie pour l'instant (identité
 * visuelle non décidée, voir decisions-techniques.md) — ce sont des
 * emplacements réservés ("briques"), pas le design final.
 */
export function CategoryNav({
  current,
  active,
}: {
  current: MarketplaceFilters;
  active?: string;
}) {
  const tiles: { value?: string; label: string }[] = [
    { value: undefined, label: "Toutes" },
    ...CATEGORIES.map((c) => ({ value: c.value as string, label: c.label })),
  ];

  return (
    <nav
      aria-label="Catégories"
      className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
    >
      {tiles.map((tile) => {
        const isActive = tile.value ? tile.value === active : !active;
        return (
          <Link
            key={tile.label}
            href={buildMarketplaceHref(current, { categorie: tile.value, page: undefined })}
            className={`flex shrink-0 flex-col items-center gap-1.5 rounded-lg border px-4 py-3 text-center ${
              isActive
                ? "border-vert-sapin bg-vert-sapin text-ivoire"
                : "border-ligne text-encre hover:border-cuivre-clair"
            }`}
          >
            <span
              aria-hidden="true"
              className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${
                isActive ? "bg-white/20" : "bg-sable text-cuivre-profond"
              }`}
            >
              {tile.label.charAt(0)}
            </span>
            <span className="text-xs font-medium whitespace-nowrap">{tile.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
