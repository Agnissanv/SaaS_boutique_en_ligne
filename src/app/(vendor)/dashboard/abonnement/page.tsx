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

/**
 * Libellés lisibles pour les clés connues de `features` (jsonb, forme libre
 * en base). Une clé absente de cette table retombe sur un libellé généré
 * (préfixe can_/has_ retiré, underscores → espaces) plutôt que de planter, au
 * cas où un nouveau flag serait ajouté en base sans être documenté ici.
 */
const FEATURE_LABELS: Record<string, string> = {
  can_multi_user: "Multi-utilisateurs",
  can_export_stats: "Export des statistiques",
  can_manage_stock: "Gestion du stock",
  can_use_variants: "Variantes produits (taille, couleur...)",
  can_use_promo_codes: "Codes promo",
  has_order_notifications: "Notifications de commande",
  has_advanced_stock_alerts: "Alertes de stock avancées",
  // Pas de "can_remove_branding" ici : retiré du modèle le 16/09/2026, le
  // badge KEVA reste visible sur toutes les boutiques quel que soit le plan
  // (voir supabase/migrations/0019_drop_can_remove_branding.sql).
};

function humanizeKey(key: string) {
  return key.replace(/^can_|^has_/, "").replace(/_/g, " ");
}

/**
 * Met en forme une seule entrée de `features` pour un vendeur — jamais la clé
 * brute. Renvoie `null` quand la valeur ne représente pas un avantage à
 * afficher (booléen à `false`, 0 collaborateur, personnalisation "none"...).
 */
function formatFeature(key: string, value: unknown): string | null {
  if (key === "max_products") {
    return value === null || value === undefined
      ? "Produits illimités"
      : `${value} produits max`;
  }
  if (key === "max_collaborators") {
    const n = Number(value);
    if (!n) return null;
    return `${n} collaborateur${n > 1 ? "s" : ""}`;
  }
  if (key === "can_customize_branding") {
    if (value === "complete") return "Personnalisation complète de la marque";
    if (value === "basic") return "Personnalisation basique de la marque";
    return null; // "none" — pas un avantage à afficher
  }
  if (typeof value === "boolean") {
    return value ? (FEATURE_LABELS[key] ?? humanizeKey(key)) : null;
  }
  return `${FEATURE_LABELS[key] ?? humanizeKey(key)} : ${value}`;
}

/**
 * Affiche `features` de façon lisible pour un vendeur — jamais les clés
 * brutes de la base (`can_manage_stock`, `max_products : null`...).
 *
 * Historique : un premier bug (corrigé le 16/09/2026) affichait la clé d'un
 * booléen qu'il vaille `true` ou `false`, donc la même liste complète sur les
 * trois plans (repéré par Isaac à l'œil). Une fois ce filtre ajouté, les clés
 * elles-mêmes restaient affichées telles quelles ("can_manage_stock",
 * "max_products : null") — repéré aussitôt par Isaac comme illisible pour un
 * client final. Corrigé le jour même avec `FEATURE_LABELS`/`formatFeature`
 * ci-dessus : chaque clé connue a un libellé français, et les valeurs qui ne
 * sont pas un avantage réel (0 collaborateur, personnalisation "none") sont
 * omises plutôt qu'affichées littéralement.
 */
function renderFeatures(features: Plan["features"]) {
  if (!features) return null;
  const items = Array.isArray(features)
    ? features.map((f) => String(f))
    : Object.entries(features)
        .map(([key, value]) => formatFeature(key, value))
        .filter((item): item is string => item !== null);

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
