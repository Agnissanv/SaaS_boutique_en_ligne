"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/bottom-sheet";
import { buildFilterHref, type MarketplaceFilters } from "@/lib/marketplace/filters";

/**
 * Contrôle de tri (marketplace + catalogue boutique) — reconstruit le
 * 15/09/2026 (chantier "langage natif", voir decisions-techniques.md) :
 * était un `<select>` natif du navigateur, un des "aveux" les plus visibles
 * qu'on est sur une page web plutôt que dans une appli — son rendu (police,
 * bordures, position du menu) échappe entièrement à la charte KEVA et n'a
 * jamais le même aspect selon l'OS. Remplacé par un bouton qui ouvre une
 * feuille d'action (`BottomSheet`) listant les choix, comme le ferait un
 * vrai sélecteur de tri d'appli mobile.
 *
 * API changée le 22/09/2026 (chantier "filtres") : `q`/`categorie` en props
 * séparées remplacées par `current: MarketplaceFilters`, délégué à
 * `buildFilterHref` — l'ancienne version reconstruisait l'URL à la main à
 * partir de seulement `q`/`categorie`/`tri`, donc changer le tri effaçait
 * silencieusement tout filtre de prix/attribut déjà actif. Les deux pages
 * qui l'utilisent passent maintenant leur objet `current` complet.
 */
export function SortSelect({
  basePath,
  value,
  options,
  current,
}: {
  basePath: string;
  value: string;
  options: { value: string; label: string }[];
  current: MarketplaceFilters;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function handleSelect(nextSort: string) {
    setOpen(false);
    if (nextSort === value) return;
    router.push(
      buildFilterHref(basePath, current, {
        tri: nextSort === "recent" ? undefined : nextSort,
        page: undefined,
      })
    );
  }

  const currentLabel = options.find((o) => o.value === value)?.label ?? options[0]?.label;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex shrink-0 items-center gap-1.5 rounded-md border border-ligne px-2.5 py-1.5 text-xs text-encre"
      >
        <span className="text-encre/60">Trier :</span>
        <span className="font-medium">{currentLabel}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3 text-encre/50">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Trier par">
        <ul>
          {options.map((o) => {
            const isActive = o.value === value;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => handleSelect(o.value)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm ${
                    isActive ? "font-semibold text-vert-sapin" : "text-encre"
                  }`}
                >
                  {o.label}
                  {isActive ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-vert-actif">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </BottomSheet>
    </>
  );
}
