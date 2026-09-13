import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getShopSubscription,
  SUBSCRIPTION_STATE_LABELS,
} from "@/lib/subscription";

type Plan = {
  id: string;
  code: string;
  name: string;
  price: number;
  duration_days: number;
  features: Record<string, unknown> | string[] | null;
};

/** Affiche `features` (jsonb, forme libre) de façon lisible sans supposer sa structure exacte. */
function renderFeatures(features: Plan["features"]) {
  if (!features) return null;
  const items = Array.isArray(features)
    ? features.map((f) => String(f))
    : Object.entries(features).map(([key, value]) =>
        typeof value === "boolean" ? key : `${key} : ${value}`
      );

  if (items.length === 0) return null;

  return (
    <ul className="mt-2 space-y-1 text-xs text-gray-600">
      {items.map((item, index) => (
        <li key={index}>• {item}</li>
      ))}
    </ul>
  );
}

/**
 * Page "Mon abonnement" — créée le 15/09/2026, manque identifié dans
 * l'analyse du dashboard vendeur : jusqu'ici le vendeur ne voyait son
 * abonnement que via une bannière d'avertissement (layout.tsx) une fois
 * expiré ou proche de l'expiration, jamais un état clair de son plan actuel
 * ni des plans disponibles (cahier des charges §3.1.A.7).
 *
 * Pas de bouton "changer de plan" ni de paiement en ligne : le renouvellement
 * passe pour l'instant par un admin qui réassigne un plan manuellement
 * (CinetPay non branché) — voir la bannière déjà présente dans layout.tsx et
 * decisions-techniques.md. Cette page est volontairement informative.
 */
export default async function SubscriptionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .eq("owner_id", user?.id ?? "")
    .maybeSingle();

  if (!shop) {
    redirect("/dashboard/boutique");
  }

  const [subscription, { data: plans }] = await Promise.all([
    getShopSubscription(supabase, shop.id),
    supabase
      .from("subscription_plans")
      .select("id, code, name, price, duration_days, features")
      .order("price", { ascending: true }),
  ]);

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900">Mon abonnement</h1>

      <div className="mt-4 max-w-md rounded-md border border-gray-200 p-4">
        <p className="text-sm text-gray-600">Plan actuel</p>
        <p className="mt-1 text-lg font-semibold text-gray-900">
          {subscription.planName ?? "Aucun abonnement"}
        </p>
        <p className="mt-1 text-sm text-gray-600">
          Statut :{" "}
          <span className="font-medium text-gray-900">
            {SUBSCRIPTION_STATE_LABELS[subscription.state]}
          </span>
        </p>
        {subscription.expiresAt && (
          <p className="mt-1 text-sm text-gray-600">
            Expire le{" "}
            {new Date(subscription.expiresAt).toLocaleDateString("fr-FR")}
          </p>
        )}
        {subscription.state === "grace_period" && (
          <p className="mt-2 text-sm text-amber-700">
            Période de grâce en cours — contacte-nous pour renouveler avant
            que l&apos;ajout de nouveaux produits soit bloqué.
          </p>
        )}
        {subscription.state === "expired" && (
          <p className="mt-2 text-sm text-red-700">
            Abonnement expiré — contacte-nous pour le renouveler.
          </p>
        )}
      </div>

      <h2 className="mt-8 text-sm font-medium text-gray-700">
        Plans disponibles
      </h2>
      <p className="mt-1 text-xs text-gray-500">
        Le paiement automatique en ligne n&apos;est pas encore disponible :
        contacte-nous pour souscrire ou changer de plan.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {(plans as Plan[] | null)?.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-md border p-4 ${
              plan.code === subscription.planCode
                ? "border-gray-900"
                : "border-gray-200"
            }`}
          >
            <p className="text-sm font-semibold text-gray-900">
              {plan.name}
              {plan.code === subscription.planCode && (
                <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-normal text-gray-600">
                  plan actuel
                </span>
              )}
            </p>
            <p className="mt-1 text-sm text-gray-600">
              {plan.price > 0 ? `${plan.price} FCFA` : "Gratuit"} /{" "}
              {plan.duration_days} jours
            </p>
            {renderFeatures(plan.features)}
          </div>
        ))}
      </div>
    </div>
  );
}
