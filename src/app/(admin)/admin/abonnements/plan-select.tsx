"use client";

import { useTransition } from "react";
import { assignPlan } from "./actions";

const PLANS = [
  { code: "free", label: "Gratuit limité" },
  { code: "essentiel", label: "Essentiel" },
  { code: "pro", label: "Pro" },
];

export function PlanSelect({ shopId, currentPlanCode }: { shopId: string; currentPlanCode: string | null }) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      defaultValue={currentPlanCode ?? ""}
      disabled={isPending}
      onChange={(e) =>
        startTransition(() => {
          assignPlan(shopId, e.target.value);
        })
      }
      className="rounded-md border border-ligne px-2 py-1 text-xs focus:ring-2 focus:ring-vert-actif disabled:opacity-50"
    >
      <option value="" disabled>
        Assigner un plan...
      </option>
      {PLANS.map((p) => (
        <option key={p.code} value={p.code}>
          {p.label}
        </option>
      ))}
    </select>
  );
}
