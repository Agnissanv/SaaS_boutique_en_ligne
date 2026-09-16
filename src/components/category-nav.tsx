import Link from "next/link";
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
 *
 * Bandeau retravaillé le 15/09/2026 (même jour, retour direct d'Isaac sur
 * une capture d'écran : "la barre de navigation... sa forme un peu
 * rectangle, qui ne touche même pas le fond"). Chaque tuile était jusqu'ici
 * une boîte individuelle avec bordure (`rounded-lg border ...`), posée
 * directement sur le fond blanc de la page — un quadrillage de petits
 * rectangles plutôt qu'une vraie "barre". Corrigé par deux changements :
 * (1) le `<nav>` porte maintenant lui-même un fond plein (Brume) et occupe
 * toute la largeur du contenu, comme le héros et l'en-tête, au lieu de
 * flotter sur du blanc ; (2) les tuiles perdent leur bordure/boîte
 * individuelle — juste un cercle d'icône (élevé par une ombre légère) et un
 * libellé en dessous, façon Amazon/Jumia, l'état actif se lisant sur le
 * remplissage du cercle plutôt que sur un encadré entier.
 *
 * `availableCategories` (16/09/2026, retour d'Isaac : "les catégories de
 * filtre... ne doivent pas s'afficher toutes, seulement celles qui sont
 * dispo") : la liste des 24 catégories n'est plus codée en dur ici — c'est
 * l'appelant (page d'accueil marketplace) qui calcule, via une requête sur
 * les produits actifs, lesquelles ont réellement au moins un produit, et ne
 * passe que celles-là. Une catégorie sans aucun produit n'est plus une
 * tuile qui mène à un rayon vide.
 */
export function CategoryNav({
  current,
  active,
  availableCategories,
}: {
  current: MarketplaceFilters;
  active?: string;
  availableCategories: { value: string; label: string }[];
}) {
  const tiles: { value?: string; label: string }[] = [
    { value: undefined, label: "Toutes" },
    ...availableCategories.map((c) => ({ value: c.value, label: c.label })),
  ];

  return (
    <nav
      aria-label="Catégories"
      className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto bg-brume px-4 py-5 scroll-smooth sm:flex-wrap sm:overflow-visible sm:rounded-2xl sm:py-6"
    >
      {tiles.map((tile) => {
        const isActive = tile.value ? tile.value === active : !active;
        return (
          <Link
            key={tile.label}
            href={buildMarketplaceHref(current, { categorie: tile.value, page: undefined })}
            className="group flex w-20 shrink-0 snap-start flex-col items-center gap-2 text-center"
          >
            <span
              aria-hidden="true"
              className={`flex h-14 w-14 items-center justify-center rounded-full transition-all duration-200 ${
                isActive
                  ? "bg-vert-sapin text-ivoire shadow-md"
                  : "bg-white text-cuivre-profond shadow-sm group-hover:-translate-y-1 group-hover:text-vert-sapin group-hover:shadow-md"
              }`}
            >
              <CategoryIcon value={tile.value ?? "all"} className="h-6 w-6" />
            </span>
            <span
              className={`line-clamp-2 text-[11px] leading-tight transition-colors ${
                isActive ? "font-semibold text-vert-sapin" : "font-medium text-encre/80 group-hover:text-vert-sapin"
              }`}
            >
              {tile.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
