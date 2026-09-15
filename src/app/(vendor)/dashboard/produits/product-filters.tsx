"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/categories";

export type ProductFiltersValue = {
  q: string;
  categorie: string;
  statut: string;
  tri: string;
};

const STATUTS = [
  { value: "", label: "Tous les statuts" },
  { value: "actif", label: "Actifs" },
  { value: "inactif", label: "Inactifs" },
];

const TRIS = [
  { value: "", label: "Plus récents" },
  { value: "prix_asc", label: "Prix croissant" },
  { value: "prix_desc", label: "Prix décroissant" },
  { value: "stock_asc", label: "Stock croissant" },
  { value: "nom_asc", label: "Nom (A→Z)" },
];

/**
 * Filtres de la liste produits — Client Component créé le 15/09/2026
 * (refonte de la page produits, sur inspiration d'une maquette envoyée par
 * le designer UX/UI d'Isaac). Reçoit les filtres actuels en props depuis
 * page.tsx (Server Component, qui les lit depuis `searchParams`) plutôt que
 * de lire `useSearchParams()` ici directement : évite d'avoir à englober ce
 * composant dans un `<Suspense>` (obligatoire dès qu'on utilise
 * useSearchParams dans un Client Component) pour un besoin qui ne le
 * justifie pas — seul `useRouter()` est utilisé pour naviguer, sans cette
 * contrainte.
 */
export function ProductFilters({ current }: { current: ProductFiltersValue }) {
  const router = useRouter();
  const [search, setSearch] = useState(current.q);

  function navigate(overrides: Partial<ProductFiltersValue>) {
    const next = { ...current, ...overrides };
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.categorie) params.set("categorie", next.categorie);
    if (next.statut) params.set("statut", next.statut);
    if (next.tri) params.set("tri", next.tri);
    const qs = params.toString();
    router.push(qs ? `/dashboard/produits?${qs}` : "/dashboard/produits");
  }

  return (
    <div className="mt-4 flex flex-wrap items-end gap-3 rounded-md border border-ligne bg-white p-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ q: search });
        }}
        className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-xs"
      >
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un produit..."
          className="w-full rounded-md border border-ligne bg-brume px-2.5 py-1.5 text-sm text-encre placeholder:text-encre/40 focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-md border border-ligne px-2.5 py-1.5 text-sm text-encre/70 hover:border-cuivre-clair hover:text-cuivre-profond"
        >
          Rechercher
        </button>
      </form>

      <label className="flex flex-col gap-1 text-xs text-encre/60">
        Catégorie
        <select
          value={current.categorie}
          onChange={(e) => navigate({ categorie: e.target.value })}
          className="rounded-md border border-ligne bg-white px-2 py-1.5 text-sm text-encre"
        >
          <option value="">Toutes catégories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-encre/60">
        Statut
        <select
          value={current.statut}
          onChange={(e) => navigate({ statut: e.target.value })}
          className="rounded-md border border-ligne bg-white px-2 py-1.5 text-sm text-encre"
        >
          {STATUTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-encre/60">
        Trier par
        <select
          value={current.tri}
          onChange={(e) => navigate({ tri: e.target.value })}
          className="rounded-md border border-ligne bg-white px-2 py-1.5 text-sm text-encre"
        >
          {TRIS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
