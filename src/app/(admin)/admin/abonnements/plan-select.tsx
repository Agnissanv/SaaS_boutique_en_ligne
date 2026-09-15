"use client";

import { useTransition } from "react";
import { NativeSelect } from "@/components/native-select";
import { assignPlan } from "./actions";

// Codes alignés sur la refonte des plans du 15/09/2026 (voir
// supabase/migrations/0016_subscription_plans_v2.sql) : starter/business/pro,
// plus les anciens codes free/essentiel qui existaient avant ce renommage.
const PLANS = [
  { code: "starter", label: "Starter (gratuit)" },
  { code: "business", label: "Business (2 500 FCFA)" },
  { code: "pro", label: "Pro (7 000 FCFA)" },
];

export function PlanSelect({ shopId, currentPlanCode }: { shopId: string; currentPlanCode: string | null }) {
  const [isPending, startTransition] = useTransition();

  return (
    <NativeSelect
      label="Plan d'abonnement"
      value={currentPlanCode ?? ""}
      placeholder="Assigner un plan..."
      disabled={isPending}
      onChange={(next) =>
        startTransition(() => {
          assignPlan(shopId, next);
        })
      }
      options={PLANS.map((p) => ({ value: p.code, label: p.label }))}
    />
  );
}
