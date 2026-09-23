"use client";

import { useState, useTransition } from "react";
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

// Durées proposées — ajouté le 23/09/2026, question directe d'Isaac : en
// attendant PawaPay, un vendeur qui paie manuellement peut très bien régler
// plusieurs mois d'un coup (fidélisation, geste commercial...). Le plan
// Starter ignore ce choix côté serveur de toute façon (gratuit, jamais
// "expiré" — voir subscription.ts) mais le sélecteur reste affiché pour ne
// pas complexifier l'UI selon le plan choisi.
const DURATIONS = [
  { value: "1", label: "1 mois" },
  { value: "2", label: "2 mois" },
  { value: "3", label: "3 mois" },
  { value: "4", label: "4 mois" },
  { value: "6", label: "6 mois" },
  { value: "12", label: "12 mois" },
];

/**
 * Plan + durée n'étaient au départ qu'un seul `<select>` de plan, déclenchant
 * `assignPlan` instantanément au changement. Passé à deux sélecteurs +
 * bouton explicite "Assigner" le 23/09/2026 pour ajouter le choix de durée :
 * un déclenchement instantané au changement de plan seul n'aurait plus eu de
 * sens une fois la durée séparée (quelle durée utiliser ? celle par défaut,
 * en ignorant silencieusement ce que l'admin vient de choisir juste à
 * côté ?) — un bouton explicite rend l'action et son résultat prévisibles.
 */
export function PlanSelect({ shopId, currentPlanCode }: { shopId: string; currentPlanCode: string | null }) {
  const [isPending, startTransition] = useTransition();
  const [plan, setPlan] = useState(currentPlanCode ?? "");
  const [duration, setDuration] = useState("1");

  return (
    <div className="flex flex-col gap-1.5">
      <NativeSelect
        label="Plan d'abonnement"
        value={plan}
        placeholder="Choisir un plan..."
        disabled={isPending}
        onChange={setPlan}
        options={PLANS.map((p) => ({ value: p.code, label: p.label }))}
      />
      <NativeSelect
        label="Durée"
        value={duration}
        disabled={isPending}
        onChange={setDuration}
        options={DURATIONS}
      />
      <button
        type="button"
        disabled={isPending || !plan}
        onClick={() =>
          startTransition(() => {
            assignPlan(shopId, plan, Number(duration));
          })
        }
        className="rounded-md bg-vert-actif px-2.5 py-1.5 text-xs font-medium text-ivoire transition hover:bg-vert-sapin disabled:opacity-50"
      >
        Assigner
      </button>
    </div>
  );
}
