"use client";

import { useRouter } from "next/navigation";

/**
 * Menu déroulant de tri (marketplace + catalogue boutique) — un `<select>`
 * avec `onChange` a besoin d'un Client Component (impossible d'attacher un
 * gestionnaire d'événement directement dans un Server Component), d'où son
 * extraction ici plutôt que dans les pages elles-mêmes qui restent des
 * Server Components pour la requête Supabase.
 *
 * `basePath`/`q`/`categorie` sont de simples chaînes (sérialisables) passées
 * depuis le Server Component parent — on ne peut pas lui passer une fonction
 * de construction d'URL, donc l'URL est reconstruite ici directement.
 */
export function SortSelect({
  basePath,
  value,
  options,
  q,
  categorie,
}: {
  basePath: string;
  value: string;
  options: { value: string; label: string }[];
  q?: string;
  categorie?: string;
}) {
  const router = useRouter();

  function handleChange(nextSort: string) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (categorie) params.set("categorie", categorie);
    if (nextSort !== "recent") params.set("tri", nextSort);
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  return (
    <label className="flex shrink-0 items-center gap-2 text-xs text-gray-600">
      Trier par
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-md border border-gray-300 px-2 py-1 text-xs"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
