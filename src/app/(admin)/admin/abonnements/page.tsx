import { createClient } from "@/lib/supabase/server";
import { computeSubscriptionState, SUBSCRIPTION_STATE_LABELS } from "@/lib/subscription";
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
      <h1 className="text-lg font-semibold text-gray-900">Abonnements</h1>
      <p className="mt-1 text-sm text-gray-600">
        Le paiement d&apos;abonnement via Mobile Money n&apos;est pas encore
        branché (CinetPay). En attendant, un plan peut être assigné
        manuellement ci-dessous.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs text-gray-500">
              <th className="py-2 pr-4">Boutique</th>
              <th className="py-2 pr-4">Plan actuel</th>
              <th className="py-2 pr-4">Statut</th>
              <th className="py-2 pr-4">Expire le</th>
              <th className="py-2 pr-4">Changer de plan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {((shops ?? []) as ShopRow[]).map((shop) => {
              const subs = Array.isArray(shop.subscriptions)
                ? shop.subscriptions
                : shop.subscriptions
                ? [shop.subscriptions]
                : [];
              const sub = subs[0];
              const plan = sub ? (Array.isArray(sub.plan) ? sub.plan[0] : sub.plan) : null;

              return (
                <tr key={shop.id}>
                  <td className="py-3 pr-4">
                    <p className="font-medium text-gray-900">{shop.name}</p>
                    <p className="text-xs text-gray-500">/{shop.slug}</p>
                  </td>
                  <td className="py-3 pr-4 text-gray-700">
                    {plan ? `${plan.name} (${plan.price} FCFA)` : "Aucun"}
                  </td>
                  <td className="py-3 pr-4 text-gray-700">
                    {sub
                      ? SUBSCRIPTION_STATE_LABELS[computeSubscriptionState(sub.expires_at)]
                      : "—"}
                  </td>
                  <td className="py-3 pr-4 text-gray-500">
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
