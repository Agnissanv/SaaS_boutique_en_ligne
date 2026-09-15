import { createClient } from "@/lib/supabase/server";
import {
  computeSubscriptionState,
  SUBSCRIPTION_STATE_LABELS,
  SUBSCRIPTION_STATE_BADGE_CLASS,
} from "@/lib/subscription";
import { TagIcon } from "@/components/admin/admin-icons";
import { PlanSelect } from "./plan-select";

type SubscriptionRow = {
  id: string;
  expires_at: string;
  plan: { code: string; name: string; price: number } | { code: string; name: string; price: number }[] | null;
};

type ShopRow = {
  id: string;
  name: string;
  slug: string;
  subscriptions: SubscriptionRow[] | SubscriptionRow | null;
};

// Classe de couleur de l'icône de plan par palier — un seul pictogramme
// (`TagIcon`), coloré différemment, plutôt que trois formes distinctes :
// suffisant pour distinguer les paliers d'un coup d'œil sans multiplier les
// dessins pour trois lignes de tableau.
const PLAN_ICON_CLASS: Record<string, string> = {
  free: "text-encre/40",
  essentiel: "text-vert-actif",
  pro: "text-cuivre-profond",
};

// Gestion des abonnements (cahier des charges §3.1.C.3). Le paiement réel
// via CinetPay n'est pas encore branché (voir decisions-techniques.md) :
// cette page permet d'assigner un plan manuellement en attendant.
//
// Le statut affiché est CALCULÉ à partir de `expires_at` (voir
// src/lib/subscription.ts), pas lu depuis `subscriptions.status` : cette
// colonne n'est écrite qu'à la création/au renouvellement et resterait
// "Actif" indéfiniment sans job planifié pour la faire expirer — ce qui
// aurait rendu ce tableau trompeur une fois le blocage vendeur en place.
export default async function AdminSubscriptionsPage() {
  const supabase = await createClient();

  const { data: shops } = await supabase
    .from("shops")
    .select(
      "id, name, slug, subscriptions(id, expires_at, plan:subscription_plans(code, name, price))"
    )
    .order("name");

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Abonnements</h1>
      <p className="mt-1 text-sm text-encre/70">
        Le paiement d&apos;abonnement via Mobile Money n&apos;est pas encore
        branché (CinetPay). En attendant, un plan peut être assigné
        manuellement ci-dessous.
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-ligne bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-ligne text-xs text-encre/50">
              <th className="py-3 pl-4 pr-4">Boutique</th>
              <th className="py-3 pr-4">Plan actuel</th>
              <th className="py-3 pr-4">Statut</th>
              <th className="py-3 pr-4">Expire le</th>
              <th className="py-3 pr-4">Changer de plan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ligne">
            {((shops ?? []) as ShopRow[]).map((shop) => {
              const subs = Array.isArray(shop.subscriptions)
                ? shop.subscriptions
                : shop.subscriptions
                ? [shop.subscriptions]
                : [];
              const sub = subs[0];
              const plan = sub ? (Array.isArray(sub.plan) ? sub.plan[0] : sub.plan) : null;
              const state = sub ? computeSubscriptionState(sub.expires_at) : null;

              return (
                <tr key={shop.id} className="transition-colors hover:bg-brume/60">
                  <td className="py-3 pl-4 pr-4">
                    <p className="font-medium text-encre">{shop.name}</p>
                    <p className="text-xs text-encre/50">/{shop.slug}</p>
                  </td>
                  <td className="py-3 pr-4 text-encre/70">
                    {plan ? (
                      <span className="flex items-center gap-1.5">
                        <TagIcon className={`h-4 w-4 shrink-0 ${PLAN_ICON_CLASS[plan.code] ?? "text-encre/40"}`} />
                        {plan.name} <span className="font-mono text-cuivre-profond">({plan.price} FCFA)</span>
                      </span>
                    ) : (
                      "Aucun"
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {state ? (
                      <span className={`rounded px-1.5 py-0.5 text-xs ${SUBSCRIPTION_STATE_BADGE_CLASS[state]}`}>
                        {SUBSCRIPTION_STATE_LABELS[state]}
                      </span>
                    ) : (
                      <span className="text-encre/50">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-encre/50">
                    {sub ? new Date(sub.expires_at).toLocaleDateString("fr-FR") : "—"}
                  </td>
                  <td className="py-3 pr-4">
                    <PlanSelect shopId={shop.id} currentPlanCode={plan?.code ?? null} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
