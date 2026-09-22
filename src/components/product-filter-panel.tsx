"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/bottom-sheet";
import { buildFilterHref, type MarketplaceFilters } from "@/lib/marketplace/filters";
import type { AttributeFacet, PriceBounds } from "@/lib/marketplace/attribute-facets";

/**
 * Panneau de filtres "bien poussés, bien intelligents, bien assistés" —
 * demande d'Isaac le 22/09/2026, construit directement sur les specs par
 * catégorie du même jour. Un seul bouton "Filtres" (badge = nombre de
 * filtres actifs) ouvrant une feuille d'action (`BottomSheet`, même
 * primitive que `SortSelect`) avec, par catégorie choisie, une case à cocher
 * par valeur réellement disponible (comptée) plus une fourchette de prix —
 * jamais une liste de champs à deviner : uniquement ce qui existe vraiment
 * dans le catalogue filtré (`computeAttributeFacets`).
 *
 * "Assisté" = les filtres se corrigent avec le contexte plutôt que de
 * planter silencieusement : changer de catégorie vide les attributs (gérés
 * par l'appelant, voir `CategoryNav` dans `page.tsx`/`[shopSlug]/page.tsx`),
 * et une valeur cochée qui disparaît du catalogue (recherche/catégorie
 * changée entre-temps) disparaît aussi de la sélection au prochain rendu.
 *
 * Générique marketplace/boutique via `basePath` + `current` (même schéma que
 * `buildFilterHref`) plutôt que codé en dur sur `/` — réutilisé tel quel par
 * les deux pages.
 *
 * Édition en brouillon (`draftAttrs`/`draftMin`/`draftMax`) : les cases à
 * cocher et les champs de prix ne naviguent qu'au clic sur "Voir les
 * produits", pas à chaque coche — cocher 3 valeurs ne doit pas déclencher 3
 * navigations/rendus serveur successifs.
 */
export function ProductFilterPanel({
  basePath,
  current,
  facets,
  priceBounds,
}: {
  basePath: string;
  current: MarketplaceFilters;
  facets: AttributeFacet[];
  priceBounds: PriceBounds | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draftAttrs, setDraftAttrs] = useState<Record<string, string[]>>(current.attrs ?? {});
  const [draftMin, setDraftMin] = useState(current.prixMin ?? "");
  const [draftMax, setDraftMax] = useState(current.prixMax ?? "");
  const [facetSearch, setFacetSearch] = useState<Record<string, string>>({});

  const activeAttrCount = Object.values(current.attrs ?? {}).reduce((n, v) => n + v.length, 0);
  const activePriceCount = current.prixMin || current.prixMax ? 1 : 0;
  const activeCount = activeAttrCount + activePriceCount;

  function openPanel() {
    // Resynchronise le brouillon sur l'état réellement appliqué (URL) à
    // chaque ouverture — au cas où les filtres actifs auraient changé entre
    // deux ouvertures (ex: suppression d'une puce depuis la liste active).
    setDraftAttrs(current.attrs ?? {});
    setDraftMin(current.prixMin ?? "");
    setDraftMax(current.prixMax ?? "");
    setOpen(true);
  }

  function toggleValue(key: string, value: string) {
    setDraftAttrs((prev) => {
      const existing = prev[key] ?? [];
      const next = existing.includes(value)
        ? existing.filter((v) => v !== value)
        : [...existing, value];
      const copy = { ...prev };
      if (next.length > 0) copy[key] = next;
      else delete copy[key];
      return copy;
    });
  }

  function apply() {
    setOpen(false);
    router.push(
      buildFilterHref(basePath, current, {
        attrs: draftAttrs,
        prixMin: draftMin.trim() || undefined,
        prixMax: draftMax.trim() || undefined,
        page: undefined,
      })
    );
  }

  function resetDraft() {
    setDraftAttrs({});
    setDraftMin("");
    setDraftMax("");
  }

  function removeChip(overrides: MarketplaceFilters) {
    router.push(buildFilterHref(basePath, current, { ...overrides, page: undefined }));
  }

  const chips = useMemo(() => {
    const items: { key: string; label: string; onRemove: () => void }[] = [];
    for (const [key, values] of Object.entries(current.attrs ?? {})) {
      const facet = facets.find((f) => f.key === key);
      for (const value of values) {
        const label = facet?.options.find((o) => o.value === value)?.label ?? value;
        items.push({
          key: `${key}:${value}`,
          label: `${facet?.label ?? key} : ${label}`,
          onRemove: () =>
            removeChip({
              attrs: { ...current.attrs, [key]: (current.attrs?.[key] ?? []).filter((v) => v !== value) },
            }),
        });
      }
    }
    if (current.prixMin || current.prixMax) {
      items.push({
        key: "prix",
        label: `Prix : ${current.prixMin ? `${Number(current.prixMin).toLocaleString("fr-FR")}` : "0"} – ${
          current.prixMax ? `${Number(current.prixMax).toLocaleString("fr-FR")} FCFA` : "∞"
        }`,
        onRemove: () => removeChip({ prixMin: undefined, prixMax: undefined }),
      });
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- removeChip capture current/basePath à chaque rendu, pas besoin de le lister.
  }, [current, facets]);

  const hasAnythingToFilter = facets.length > 0 || priceBounds !== null;
  if (!hasAnythingToFilter) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={openPanel}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-ligne px-2.5 py-1.5 text-xs text-encre"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 text-encre/60">
            <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-medium">Filtres</span>
          {activeCount > 0 ? (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-vert-actif px-1 text-[10px] font-semibold text-ivoire">
              {activeCount}
            </span>
          ) : null}
        </button>

        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={chip.onRemove}
            className="flex items-center gap-1 rounded-full bg-brume px-3 py-1 text-xs font-medium text-vert-sapin"
          >
            {chip.label}
            <span aria-hidden="true" className="text-vert-sapin/60">
              ✕
            </span>
          </button>
        ))}
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Filtres">
        <div className="flex flex-col gap-5 px-2 pb-2">
          {priceBounds ? (
            <div>
              <p className="mb-2 text-sm font-medium text-encre">Prix (FCFA)</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={draftMin}
                  onChange={(e) => setDraftMin(e.target.value)}
                  placeholder={priceBounds.min.toLocaleString("fr-FR")}
                  className="w-full min-w-0 rounded-md border border-ligne px-3 py-2 text-sm text-encre placeholder:text-encre/40 focus:outline-none focus:ring-2 focus:ring-vert-actif"
                />
                <span className="text-encre/40">–</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={draftMax}
                  onChange={(e) => setDraftMax(e.target.value)}
                  placeholder={priceBounds.max.toLocaleString("fr-FR")}
                  className="w-full min-w-0 rounded-md border border-ligne px-3 py-2 text-sm text-encre placeholder:text-encre/40 focus:outline-none focus:ring-2 focus:ring-vert-actif"
                />
              </div>
            </div>
          ) : null}

          {facets.map((facet) => {
            const query = facetSearch[facet.key]?.trim().toLowerCase() ?? "";
            const visibleOptions = query
              ? facet.options.filter((o) => o.label.toLowerCase().includes(query))
              : facet.options;
            return (
              <div key={facet.key}>
                <p className="mb-2 text-sm font-medium text-encre">{facet.label}</p>
                {facet.options.length > 8 ? (
                  <input
                    type="text"
                    value={facetSearch[facet.key] ?? ""}
                    onChange={(e) => setFacetSearch((prev) => ({ ...prev, [facet.key]: e.target.value }))}
                    placeholder={`Rechercher dans ${facet.label.toLowerCase()}...`}
                    className="mb-2 w-full rounded-md border border-ligne px-3 py-1.5 text-xs text-encre placeholder:text-encre/40 focus:outline-none focus:ring-2 focus:ring-vert-actif"
                  />
                ) : null}
                <div className="flex max-h-48 flex-col gap-0.5 overflow-y-auto">
                  {visibleOptions.length === 0 ? (
                    <p className="px-1 py-1 text-xs text-encre/50">Aucun résultat.</p>
                  ) : (
                    visibleOptions.map((option) => {
                      const checked = draftAttrs[facet.key]?.includes(option.value) ?? false;
                      return (
                        <label
                          key={option.value}
                          className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm text-encre hover:bg-brume"
                        >
                          <span className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleValue(facet.key, option.value)}
                              className="h-4 w-4 rounded border-ligne text-vert-actif focus:ring-vert-actif"
                            />
                            {option.label}
                          </span>
                          <span className="font-mono text-xs text-encre/50">{option.count}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={resetDraft}
              className="flex-1 rounded-md border border-ligne px-3 py-2.5 text-sm font-medium text-encre"
            >
              Réinitialiser
            </button>
            <button
              type="button"
              onClick={apply}
              className="flex-1 rounded-md bg-vert-actif px-3 py-2.5 text-sm font-medium text-ivoire"
            >
              Voir les produits
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
