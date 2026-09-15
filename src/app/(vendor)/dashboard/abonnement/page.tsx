import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getShopSubscription,
  SUBSCRIPTION_STATE_LABELS,
} from "@/lib/subscription";
import { UpgradeButton } from "./upgrade-button";

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
    <ul className="mt-2 space-y-1 text-xs text-encre/70">
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
 * Paiement CinetPay réel branché le 15/09/2026 (compte marchand d'Isaac
 * validé) : un bouton "Passer à ce plan" sur les plans payants démarre un
 * vrai paiement Mobile Money (voir actions.ts/upgrade-button.tsx et
 * /api/cinetpay/webhook pour l'activation à la confirmation). L'assignation
 * manuelle par un admin (`/admin/abonnements`) reste possible en parallèle
 * pour les cas hors CinetPay (virement direct, geste commercial...).
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
      <h1 className="font-display text-lg font-semibold text-encre">Mon abonnement</h1>

      <div className="mt-4 max-w-md rounded-lg border border-ligne bg-white p-4">
        <p className="text-sm text-encre/60">Plan actuel</p>
        <p className="mt-1 font-display text-lg font-semibold text-encre">
          {subscription.planName ?? "Aucun abonnement"}
        </p>
        <p className="mt-1 text-sm text-encre/70">
          Statut :{" "}
          <span className="font-medium text-encre">
            {SUBSCRIPTION_STATE_LABELS[subscription.state]}
          </span>
        </p>
        {subscription.expiresAt && (
          <p className="mt-1 text-sm text-encre/70">
            Expire le{" "}
            {new Date(subscription.expiresAt).toLocaleDateString("fr-FR")}
          </p>
        )}
        {subscription.state === "grace_period" && (
          <p className="mt-2 text-sm text-attention">
            Période de grâce en cours — contacte-nous pour renouveler avant
            que l&apos;ajout de nouveaux produits soit bloqué.
          </p>
        )}
        {subscription.state === "expired" && (
          <p className="mt-2 text-sm text-erreur">
            Abonnement expiré — contacte-nous pour le renouveler.
          </p>
        )}
      </div>

      <h2 className="mt-8 font-display text-sm font-semibold text-encre">
        Plans disponibles
      </h2>
      <p className="mt-1 text-xs text-encre/60">
        Paiement Mobile Money sécurisé via CinetPay — le plan est activé dès
        confirmation du paiement.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {(plans as Plan[] | null)?.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-lg border bg-white p-4 ${
              plan.code === subscription.planCode
                ? "border-vert-sapin"
                : "border-ligne"
            }`}
          >
            <p className="text-sm font-semibold text-encre">
              {plan.name}
              {plan.code === subscription.planCode && (
                <span className="ml-2 rounded bg-sable px-1.5 py-0.5 text-xs font-normal text-encre/70">
                  plan actuel
                </span>
              )}
            </p>
            <p className="mt-1 text-sm text-encre/70">
              {plan.price > 0 ? (
                <span className="font-mono text-cuivre-profond">
                  {plan.price} FCFA
                </span>
              ) : (
                <span className="font-medium text-succes">Gratuit</span>
              )}{" "}
              / {plan.duration_days} jours
            </p>
            {renderFeatures(plan.features)}
            {plan.price > 0 && plan.code !== subscription.planCode && (
              <UpgradeButton planCode={plan.code} planName={plan.name} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
