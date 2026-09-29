"use client";

import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/native-select";

const PERIODES = [
  { value: "7", label: "7 derniers jours" },
  { value: "30", label: "30 derniers jours" },
  { value: "90", label: "90 derniers jours" },
];

/**
 * Sélecteur de période (7/30/90 jours) — enrichissement du 16/09/2026 (plan
 * Business+). Même motif que `product-filters.tsx` : la valeur actuelle est
 * lue depuis `searchParams` par `page.tsx` (Server Component) et passée en
 * prop ici, seul `useRouter()` est utilisé pour naviguer — évite d'avoir à
 * englober ce composant dans un `<Suspense>` pour un besoin qui ne le
 * justifie pas.
 *
 * `basePath` ajouté le 29/09/2026 (défaut inchangé) pour être réutilisé tel
 * quel par l'Aperçu du dashboard (`/dashboard`, refonte inspirée d'une
 * maquette envoyée par Isaac) plutôt que d'en dupliquer une copie — seule la
 * route de destination change d'une page à l'autre.
 */
export function PeriodSelect({
  current,
  basePath = "/dashboard/statistiques",
}: {
  current: string;
  basePath?: string;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-1 text-xs text-encre/60">
      <NativeSelect
        label="Période"
        value={current}
        onChange={(next) => {
          const qs = next && next !== "30" ? `?periode=${next}` : "";
          router.push(`${basePath}${qs}`);
        }}
        className="py-1.5"
        options={PERIODES}
      />
    </div>
  );
}
