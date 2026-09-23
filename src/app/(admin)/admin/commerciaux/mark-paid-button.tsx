"use client";

import { useTransition } from "react";
import { markCommercialPaid } from "./actions";

/**
 * Pointage manuel "j'ai payé ce commercial" — même pattern que PlanSelect
 * (admin/abonnements/plan-select.tsx) : appel direct de la Server Action via
 * useTransition, pas de formulaire (rien à saisir, juste confirmer une
 * action déjà faite en dehors de l'app).
 */
export function MarkPaidButton({ commercialId }: { commercialId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => markCommercialPaid(commercialId))}
      className="rounded-md border border-ligne bg-white px-2.5 py-1.5 text-xs font-medium text-encre transition hover:border-vert-actif hover:text-vert-actif disabled:opacity-50"
    >
      {isPending ? "..." : "Marquer tout payé"}
    </button>
  );
}
