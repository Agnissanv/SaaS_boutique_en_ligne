"use client";

import { useRouter } from "next/navigation";

/** Choix du mois affiché (« Novembre 2026 »), dans l'adresse : ?mois=AAAA-MM. */
export function MonthSelect({
  value,
  options,
  basePath,
}: {
  value: string;
  options: { value: string; label: string }[];
  basePath: string;
}) {
  const router = useRouter();
  return (
    <select
      aria-label="Mois affiché"
      value={value}
      onChange={(e) => router.push(`${basePath}?mois=${e.target.value}`, { scroll: false })}
      className="rounded-md border border-ligne bg-white px-3 py-1.5 text-sm capitalize text-encre focus:border-vert-actif focus:outline-none"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} className="capitalize">
          {option.label}
        </option>
      ))}
    </select>
  );
}
