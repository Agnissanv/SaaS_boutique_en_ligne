import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import { CategoryIcon } from "@/components/category-icon";
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
 * Repositionnée sous le hero et légèrement animée le 15/09/2026, dans le
 * cadre de la refonte de la page d'accueil — comportement et structure
 * inchangés, seule la tuile active gagne une ombre pour se distinguer plus
 * nettement au premier coup d'œil.
 *
 * Icônes ajoutées le 15/09/2026 (round 2, retour d'Isaac : "nos catégories
 * sont très petites pour une grande marketplace") en même temps que
 * l'extension de `CATEGORIES` (6 → 24, voir `src/lib/categories.ts`) : les
 * pastilles à l'initiale d'origine ("briques" volontairement provisoires,
 * voir l'historique de ce fichier) commençaient à produire de vraies
 * collisions visuelles à 24 catégories (plusieurs "Mode *"/"Maison"
 * partagent un M, "Bijoux"/"Beauté"/"Bébé"/"Bricolage" partagent un B) —
 * remplacées par une icône distincte par catégorie (`CategoryIcon`).
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
      className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 scroll-smooth sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
    >
      {tiles.map((tile) => {
        const isActive = tile.value ? tile.value === active : !active;
        return (
          <Link
            key={tile.label}
            href={buildMarketplaceHref(current, { categorie: tile.value, page: undefined })}
            className={`flex w-20 shrink-0 snap-start flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-center transition-all ${
              isActive
                ? "border-vert-sapin bg-vert-sapin text-ivoire shadow-md"
                : "border-ligne text-encre hover:-translate-y-0.5 hover:border-cuivre-clair hover:shadow-sm"
            }`}
          >
            <span
              aria-hidden="true"
              className={`flex h-9 w-9 items-center justify-center rounded-full ${
                isActive ? "bg-white/20 text-ivoire" : "bg-sable text-cuivre-profond"
              }`}
            >
              <CategoryIcon value={tile.value ?? "all"} />
            </span>
            <span className="line-clamp-2 text-[11px] font-medium leading-tight">{tile.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
