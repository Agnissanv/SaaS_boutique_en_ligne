import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getShopSubscription,
  SUBSCRIPTION_STATE_LABELS,
} from "@/lib/subscription";
import { isNyolePaymentsEnabled } from "@/lib/nyole";
import { getPlanFeatureList } from "@/lib/plan-features";
import { UpgradeButton } from "./upgrade-button";
import { SettingsTabs } from "../settings-tabs";

type Plan = {
  id: string;
  code: string;
  name: string;
  price: number;
  duration_days: number;
  features: Record<string, unknown> | string[] | null;
};

/**
 * Affiche `features` de façon lisible pour un vendeur — jamais les clés
 * brutes de la base (`can_manage_stock`, `max_products : null`...).
 *
 * Historique : un premier bug (corrigé le 16/09/2026) affichait la clé d'un
 * booléen qu'il vaille `true` ou `false`, donc la même liste complète sur les
 * trois plans (repéré par Isaac à l'œil). Une fois ce filtre ajouté, les clés
 * elles-mêmes restaient affichées telles quelles ("can_manage_stock",
 * "max_products : null") — repéré aussitôt par Isaac comme illisible pour un
 * client final. Corrigé le jour même avec une table de libellés français,
 * qui omet les valeurs qui ne sont pas un avantage réel (0 collaborateur,
 * personnalisation "none") plutôt que de les afficher littéralement.
 *
 * Logique de formatage extraite le 29/09/2026 dans `@/lib/plan-features`
 * (voir ce fichier) pour être réutilisée telle quelle par la nouvelle page
 * publique `/tarifs`.
 */
function renderFeatures(features: Plan["features"]) {
  const items = getPlanFeatureList(features);

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
 * Paiement Nyole réel branché le 28/09/2026 (bascule complète depuis
 * CinetPay, compte Nyole d'Isaac vérifié — voir decisions-techniques.md) :
 * un bouton "Passer à ce plan" sur les plans payants démarre un vrai
 * paiement Mobile Money/carte (voir actions.ts/upgrade-button.tsx et
 * /api/nyole/webhook pour l'activation à la confirmation). L'assignation
 * manuelle par un admin (`/admin/abonnements`) reste possible en parallèle
 * pour les cas hors Nyole (virement direct, geste commercial...).
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

  // Coupe-circuit optionnel — voir `isNyolePaymentsEnabled` dans nyole.ts. Le
  // bouton de paiement est masqué plutôt que laissé cliquable pour échouer :
  // un vendeur qui veut quand même changer de plan pendant une éventuelle
  // pause est orienté vers le contact, l'admin pouvant toujours assigner un
  // plan manuellement depuis /admin/abonnements.
  const nyoleEnabled = isNyolePaymentsEnabled();

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Paramètres</h1>
      <p className="mt-2 text-sm text-encre/70">Gère ton profil, ta boutique et ton compte.</p>
      <SettingsTabs isOwner />

      <h2 className="mt-6 font-display text-sm font-semibold text-encre">Mon abonnement</h2>

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
        {subscription.isTrial && subscription.state !== "expired" && (
          <p className="mt-2 rounded-md bg-vert-sapin/10 px-2 py-1.5 text-sm text-vert-sapin">
            🎁 Mois d&apos;essai offert pour ton lancement : toutes les
            fonctionnalités Pro, gratuitement jusqu&apos;au{" "}
            {subscription.expiresAt &&
              new Date(subscription.expiresAt).toLocaleDateString("fr-FR")}
            . Passe ensuite à un plan payant pour continuer d&apos;en
            profiter.
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
      {nyoleEnabled ? (
        <p className="mt-1 text-xs text-encre/60">
          Paiement Mobile Money/carte sécurisé via Nyole — le plan est activé
          dès confirmation du paiement.
        </p>
      ) : (
        <p className="mt-1 rounded-md bg-brume px-2 py-1.5 text-xs text-encre/70">
          Le paiement en ligne est temporairement indisponible.{" "}
          <Link href="/dashboard/aide" className="underline">
            Contacte-nous
          </Link>{" "}
          pour mettre à niveau ton abonnement.
        </p>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                <span className="ml-2 rounded bg-brume px-1.5 py-0.5 text-xs font-normal text-encre/70">
                  plan actuel
                </span>
              )}
            </p>
            <p className="mt-1 text-sm text-encre/70">
              {plan.price > 0 ? (
                <span className="font-mono text-vert-actif">
                  {plan.price} FCFA
                </span>
              ) : (
                <span className="font-medium text-succes">Gratuit</span>
              )}{" "}
              / {plan.duration_days} jours
            </p>
            {renderFeatures(plan.features)}
            {nyoleEnabled && plan.price > 0 && plan.code !== subscription.planCode && (
              <UpgradeButton planCode={plan.code} planName={plan.name} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
