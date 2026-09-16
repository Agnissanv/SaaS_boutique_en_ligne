import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getShopSubscription } from "@/lib/subscription";
import { getAccessibleShop } from "@/lib/shop-access";
import { ORDER_STATUS_LABELS, ORDER_STATUS_BAR_CLASS } from "@/lib/orders";
import { RevenueTrendChart, StatusBreakdown, RankedList, ComparisonTile } from "./charts";

type OrderRow = { id: string; created_at: string; total_amount: number; status: string };
type BestSeller = { product_id: string; title: string; quantity_sold: number };
type ViewedProduct = { id: string; title: string; view_count: number };

const TREND_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

const FMT_FCFA = new Intl.NumberFormat("fr-FR");

/**
 * "Vraies statistiques" avec graphiques — ajoutée le 16/09/2026 en réponse à
 * un manque qu'Isaac a lui-même identifié en comparant KEVA à un logiciel de
 * gestion concurrent : le cahier des charges promettait déjà des
 * "statistiques avancées" (Priorité 2 : produits les plus vus, taux de
 * conversion) jamais construites — `/dashboard` (Aperçu) affichait jusqu'ici
 * les mêmes chiffres bruts à tous les plans, sans graphique. Voir
 * decisions-techniques.md pour le détail complet.
 *
 * Accessible à un collaborateur actif (plan Pro), pas seulement au
 * propriétaire — cohérent avec `/dashboard` (Aperçu), qui affiche déjà le CA
 * à un collaborateur ; cette page en est le prolongement, pas une nouvelle
 * surface plus sensible.
 *
 * Deux niveaux tranchés par Isaac (`subscription.ts`) :
 * - Business (`hasAdvancedStats`) : courbe de CA, produits les plus
 *   vendus/vus, répartition des commandes par statut.
 * - Pro (`hasFullStats`, en plus) : comparaison de périodes (30 derniers
 *   jours vs 30 jours précédents) et taux de conversion.
 */
export default async function StatistiquesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const access = user ? await getAccessibleShop(supabase, user.id) : null;
  if (!access) {
    redirect("/dashboard/boutique");
  }

  const subscription = await getShopSubscription(supabase, access.shopId);

  if (!subscription.features.hasAdvancedStats) {
    return (
      <div>
        <h1 className="font-display text-lg font-semibold text-encre">Statistiques</h1>
        <p className="mt-2 max-w-md text-sm text-encre/70">
          Va au-delà des chiffres bruts de l&apos;aperçu : courbe de chiffre
          d&apos;affaires, produits les plus vendus et les plus vus,
          répartition des commandes par statut.
        </p>
        <p className="mt-4 max-w-md rounded-md border border-dashed border-ligne bg-brume px-3 py-2 text-sm text-encre/60">
          Les statistiques avec graphiques sont disponibles à partir du plan
          Business.
        </p>
      </div>
    );
  }

  // Fenêtre de 60 jours : 30 pour la courbe/répartition affichées, 30 de plus
  // pour calculer la comparaison de périodes (Pro) sans une deuxième requête.
  const since = new Date();
  since.setDate(since.getDate() - TREND_DAYS * 2);

  const [
    { data: recentOrders },
    { count: totalOrdersCount },
    { data: bestSellersRaw },
    { data: viewedProductsRaw },
    { data: shop },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("id, created_at, total_amount, status")
      .eq("shop_id", access.shopId)
      .gte("created_at", since.toISOString()),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", access.shopId),
    supabase.rpc("get_shop_best_sellers", { p_shop_id: access.shopId, p_limit: 5 }),
    supabase
      .from("products")
      .select("id, title, view_count")
      .eq("shop_id", access.shopId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("view_count", { ascending: false })
      .limit(5),
    supabase.from("shops").select("view_count").eq("id", access.shopId).maybeSingle(),
  ]);

  const orders = (recentOrders ?? []) as OrderRow[];
  const bestSellers = (bestSellersRaw ?? []) as BestSeller[];
  const viewedProducts = ((viewedProductsRaw ?? []) as ViewedProduct[]).filter(
    (p) => p.view_count > 0
  );

  const todayStart = startOfDay(new Date());
  const currentPeriodStart = todayStart - (TREND_DAYS - 1) * DAY_MS;
  const previousPeriodStart = currentPeriodStart - TREND_DAYS * DAY_MS;

  const dayBuckets = new Map<number, number>();
  for (let i = 0; i < TREND_DAYS; i++) {
    dayBuckets.set(currentPeriodStart + i * DAY_MS, 0);
  }

  let currentPeriodRevenue = 0;
  let currentPeriodOrders = 0;
  let previousPeriodRevenue = 0;
  let previousPeriodOrders = 0;
  const statusCounts = new Map<string, number>();

  // CA = commandes non annulées, même définition que partout ailleurs dans
  // le projet (aperçu, relevé de paiements) — voir decisions-techniques.md.
  for (const order of orders) {
    if (order.status === "cancelled") continue;
    const day = startOfDay(new Date(order.created_at));

    if (day >= currentPeriodStart) {
      currentPeriodRevenue += order.total_amount;
      currentPeriodOrders += 1;
      if (dayBuckets.has(day)) {
        dayBuckets.set(day, (dayBuckets.get(day) ?? 0) + order.total_amount);
      }
      statusCounts.set(order.status, (statusCounts.get(order.status) ?? 0) + 1);
    } else if (day >= previousPeriodStart) {
      previousPeriodRevenue += order.total_amount;
      previousPeriodOrders += 1;
    }
  }

  const trendPoints = Array.from(dayBuckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([ts, value]) => ({
      label: new Date(ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
      value,
    }));

  const statusRows = Object.keys(ORDER_STATUS_LABELS)
    .map((status) => ({
      label: ORDER_STATUS_LABELS[status],
      count: statusCounts.get(status) ?? 0,
      badgeClass: ORDER_STATUS_BAR_CLASS[status] ?? "bg-encre/30",
    }))
    .filter((row) => row.count > 0);

  // Taux de conversion : approximatif et assumé comme tel (pas de
  // déduplication de vues, `shops.view_count` est un compteur brut depuis le
  // début — migration 0005). Calculé sur la durée de vie de la boutique, pas
  // sur 30 jours, pour rester cohérent avec ce même compteur cumulatif.
  const conversionRate =
    shop?.view_count && shop.view_count > 0
      ? ((totalOrdersCount ?? 0) / shop.view_count) * 100
      : null;

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Statistiques</h1>
      <p className="mt-2 text-sm text-encre/70">Vue d&apos;ensemble des 30 derniers jours.</p>

      <div className="mt-6 rounded-lg border border-ligne bg-white p-4">
        <h2 className="font-display text-sm font-semibold text-encre">Chiffre d&apos;affaires</h2>
        <div className="mt-3">
          <RevenueTrendChart points={trendPoints} />
        </div>
      </div>

      {subscription.features.hasFullStats && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <ComparisonTile
            label="CA (30 derniers jours)"
            current={currentPeriodRevenue}
            previous={previousPeriodRevenue}
            format={(n) => `${FMT_FCFA.format(n)} FCFA`}
          />
          <ComparisonTile
            label="Commandes (30 derniers jours)"
            current={currentPeriodOrders}
            previous={previousPeriodOrders}
            format={(n) => String(n)}
          />
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-ligne bg-white p-4">
          <h2 className="font-display text-sm font-semibold text-encre">
            Produits les plus vendus
          </h2>
          <div className="mt-3">
            <RankedList
              items={bestSellers.map((p) => ({
                label: p.title,
                value: `${p.quantity_sold} vendu(s)`,
              }))}
              emptyLabel="Aucune vente pour l'instant."
            />
          </div>
        </div>

        <div className="rounded-lg border border-ligne bg-white p-4">
          <h2 className="font-display text-sm font-semibold text-encre">Produits les plus vus</h2>
          <div className="mt-3">
            <RankedList
              items={viewedProducts.map((p) => ({
                label: p.title,
                value: `${p.view_count} vue(s)`,
              }))}
              emptyLabel="Pas encore de vues enregistrées."
            />
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-ligne bg-white p-4">
        <h2 className="font-display text-sm font-semibold text-encre">
          Commandes par statut (30 derniers jours)
        </h2>
        <div className="mt-3">
          <StatusBreakdown rows={statusRows} />
        </div>
      </div>

      {subscription.features.hasFullStats && (
        <div className="mt-4 rounded-lg border border-ligne bg-white p-4">
          <h2 className="font-display text-sm font-semibold text-encre">Taux de conversion</h2>
          {conversionRate === null ? (
            <p className="mt-2 text-sm text-encre/60">
              Pas encore assez de vues pour calculer un taux de conversion.
            </p>
          ) : (
            <>
              <p className="mt-1 font-mono text-lg font-semibold text-cuivre-profond">
                {conversionRate.toFixed(1)}%
              </p>
              <p className="mt-1 text-xs text-encre/50">
                {totalOrdersCount ?? 0} commande(s) pour {shop?.view_count ?? 0} vue(s) de la
                boutique, depuis le début.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
