import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getShopSubscription } from "@/lib/subscription";
import { getAccessibleShop } from "@/lib/shop-access";
import { getShopRating } from "@/lib/reviews";
import { ORDER_STATUS_LABELS, ORDER_STATUS_BAR_CLASS } from "@/lib/orders";
import {
  RevenueTrendChart,
  StatusBreakdown,
  RankedList,
  ComparisonTile,
  StatTile,
  RevenueBars,
} from "./charts";
import { PeriodSelect } from "./period-select";

type OrderRow = {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
  payment_method: string;
  customer_phone: string;
  promo_code_id: string | null;
  discount_amount: number;
};
type BestSeller = { product_id: string; title: string; quantity_sold: number };
type ViewedProduct = { id: string; title: string; view_count: number };
type CategoryRow = { category: string; revenue: number; quantity_sold: number };
type TopCustomerRow = {
  customer_phone: string;
  customer_name: string;
  total_spent: number;
  order_count: number;
};
type CustomerPeriodStats = {
  unique_customers: number;
  new_customers: number;
  returning_customers: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  mobile_money: "Mobile Money",
  cash_on_delivery: "Paiement à la livraison",
};

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

const FMT_FCFA = new Intl.NumberFormat("fr-FR");

/**
 * "Vraies statistiques" avec graphiques — ajoutée le 16/09/2026 en réponse à
 * un manque qu'Isaac a lui-même identifié en comparant KEVA à un logiciel de
 * gestion concurrent, puis largement enrichie le même jour ("je veux que les
 * stats soit vraiment complet et très riche"). Voir decisions-techniques.md
 * pour l'historique complet des deux tranches.
 *
 * Accessible à un collaborateur actif (plan Pro), pas seulement au
 * propriétaire — cohérent avec `/dashboard` (Aperçu), qui affiche déjà le CA
 * à un collaborateur. Nuance ajoutée avec l'enrichissement : cette page
 * expose maintenant des données clients nominatives (téléphone, nom,
 * dépense cumulée) et la performance des codes promo, plus sensibles que le
 * CA agrégé déjà visible ailleurs — un choix volontairement laissé tel quel
 * (collaborateur = même périmètre commercial que le propriétaire côté
 * commandes, cf. `src/lib/shop-access.ts`) plutôt que d'introduire une
 * troisième granularité d'accès ad hoc pour cette seule page.
 *
 * Deux niveaux tranchés par Isaac (`subscription.ts`) :
 * - Business (`hasAdvancedStats`) : sélecteur de période (7/30/90 jours),
 *   courbe de CA et de commandes, panier moyen, produits les plus
 *   vendus/vus, répartition par statut/moyen de paiement/catégorie, taux
 *   d'annulation, valeur du stock, produits jamais vendus, note moyenne des
 *   avis.
 * - Pro (`hasFullStats`, en plus) : comparaison de périodes (CA, commandes,
 *   panier moyen), clients uniques/nouveaux/récurrents, meilleurs clients,
 *   statistiques codes promo, taux de conversion par produit.
 */
export default async function StatistiquesPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
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
          répartition des commandes par statut, et bien plus sur les plans
          supérieurs.
        </p>
        <p className="mt-4 max-w-md rounded-md border border-dashed border-ligne bg-brume px-3 py-2 text-sm text-encre/60">
          Les statistiques avec graphiques sont disponibles à partir du plan
          Business.
        </p>
      </div>
    );
  }

  // Sélecteur de période (Business+, enrichissement du 16/09/2026) : 7/30/90
  // jours, lu depuis l'URL (`?periode=`) plutôt que `useSearchParams()` côté
  // client — même motif que `product-filters.tsx`. 30 jours reste la valeur
  // par défaut (comportement identique à la version précédente de la page).
  const { periode } = await searchParams;
  const periodDays = periode === "7" || periode === "90" ? parseInt(periode, 10) : 30;

  const todayStart = startOfDay(new Date());
  const currentPeriodStart = todayStart - (periodDays - 1) * DAY_MS;
  const previousPeriodStart = currentPeriodStart - periodDays * DAY_MS;

  // Fenêtre = 2x la période choisie : la moitié récente pour la courbe/les
  // répartitions affichées, l'autre moitié pour la comparaison de périodes
  // (Pro), sans deuxième requête sur `orders`.
  const since = new Date(previousPeriodStart);

  const [
    { data: recentOrders },
    { count: totalOrdersCount },
    { data: bestSellersRaw },
    { data: neverSoldRaw },
    { data: viewedProductsRaw },
    { data: allActiveProducts },
    { data: shop },
    { data: categoryBreakdownRaw },
    rating,
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, created_at, total_amount, status, payment_method, customer_phone, promo_code_id, discount_amount"
      )
      .eq("shop_id", access.shopId)
      .gte("created_at", since.toISOString()),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", access.shopId),
    supabase.rpc("get_shop_best_sellers", { p_shop_id: access.shopId, p_limit: 5 }),
    // Limite haute (pas de vrai "top N") : sert uniquement à obtenir
    // l'ensemble complet des produits déjà vendus au moins une fois, pour en
    // déduire par différence les produits jamais vendus ci-dessous.
    supabase.rpc("get_shop_best_sellers", { p_shop_id: access.shopId, p_limit: 10000 }),
    supabase
      .from("products")
      .select("id, title, view_count")
      .eq("shop_id", access.shopId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("view_count", { ascending: false })
      .limit(5),
    supabase
      .from("products")
      .select("id, title, price, stock, view_count")
      .eq("shop_id", access.shopId)
      .eq("is_active", true)
      .is("deleted_at", null),
    supabase.from("shops").select("view_count").eq("id", access.shopId).maybeSingle(),
    supabase.rpc("get_shop_category_breakdown", {
      p_shop_id: access.shopId,
      p_since: new Date(currentPeriodStart).toISOString(),
    }),
    getShopRating(supabase, access.shopId),
  ]);

  const orders = (recentOrders ?? []) as OrderRow[];
  const bestSellers = (bestSellersRaw ?? []) as BestSeller[];
  // Ventes cumulées depuis toujours, par produit — dérivé du même appel
  // `get_shop_best_sellers` à `p_limit` élevé que pour les produits jamais
  // vendus ci-dessous, réutilisé aussi pour le taux de conversion par
  // produit (Pro) plutôt que de refaire une requête.
  const lifetimeSales = new Map(
    ((neverSoldRaw ?? []) as BestSeller[]).map((p) => [p.product_id, p.quantity_sold])
  );
  const soldProductIds = new Set(lifetimeSales.keys());
  const viewedProducts = ((viewedProductsRaw ?? []) as ViewedProduct[]).filter(
    (p) => p.view_count > 0
  );
  const allProducts = (allActiveProducts ?? []) as {
    id: string;
    title: string;
    price: number;
    stock: number;
    view_count: number;
  }[];
  const categoryBreakdown = (categoryBreakdownRaw ?? []) as CategoryRow[];

  const dayBuckets = new Map<number, { revenue: number; orders: number }>();
  for (let i = 0; i < periodDays; i++) {
    dayBuckets.set(currentPeriodStart + i * DAY_MS, { revenue: 0, orders: 0 });
  }

  let currentPeriodRevenue = 0;
  let currentPeriodOrders = 0;
  let currentPeriodCancelled = 0;
  let currentPeriodTotal = 0;
  let previousPeriodRevenue = 0;
  let previousPeriodOrders = 0;
  const statusCounts = new Map<string, number>();
  const paymentRevenue = new Map<string, number>();
  let promoOrdersCount = 0;
  let promoDiscountTotal = 0;

  // CA = commandes non annulées, même définition que partout ailleurs dans
  // le projet (aperçu, relevé de paiements) — voir decisions-techniques.md.
  for (const order of orders) {
    const day = startOfDay(new Date(order.created_at));
    const inCurrentPeriod = day >= currentPeriodStart;
    const inPreviousPeriod = !inCurrentPeriod && day >= previousPeriodStart;

    if (inCurrentPeriod) {
      currentPeriodTotal += 1;
      if (order.status === "cancelled") {
        currentPeriodCancelled += 1;
      }
    }

    if (order.status === "cancelled") continue;

    if (inCurrentPeriod) {
      currentPeriodRevenue += order.total_amount;
      currentPeriodOrders += 1;
      const bucket = dayBuckets.get(day);
      if (bucket) {
        bucket.revenue += order.total_amount;
        bucket.orders += 1;
      }
      statusCounts.set(order.status, (statusCounts.get(order.status) ?? 0) + 1);
      paymentRevenue.set(
        order.payment_method,
        (paymentRevenue.get(order.payment_method) ?? 0) + order.total_amount
      );
      if (order.promo_code_id) {
        promoOrdersCount += 1;
        promoDiscountTotal += order.discount_amount;
      }
    } else if (inPreviousPeriod) {
      previousPeriodRevenue += order.total_amount;
      previousPeriodOrders += 1;
    }
  }

  const trendPoints = Array.from(dayBuckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([ts, v]) => ({
      label: new Date(ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
      value: v.revenue,
    }));
  const orderCountPoints = Array.from(dayBuckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([ts, v]) => ({
      label: new Date(ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
      value: v.orders,
    }));

  const statusRows = Object.keys(ORDER_STATUS_LABELS)
    .map((status) => ({
      label: ORDER_STATUS_LABELS[status],
      count: statusCounts.get(status) ?? 0,
      badgeClass: ORDER_STATUS_BAR_CLASS[status] ?? "bg-encre/30",
    }))
    .filter((row) => row.count > 0);

  const paymentRows = Array.from(paymentRevenue.entries())
    .map(([method, revenue]) => ({
      label: PAYMENT_METHOD_LABELS[method] ?? method,
      revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const categoryRows = categoryBreakdown.map((c) => ({
    label: c.category,
    revenue: c.revenue,
    sublabel: `${c.quantity_sold} vendu(s)`,
  }));

  const currentAvgOrderValue = currentPeriodOrders > 0 ? currentPeriodRevenue / currentPeriodOrders : 0;
  const previousAvgOrderValue = previousPeriodOrders > 0 ? previousPeriodRevenue / previousPeriodOrders : 0;
  const cancellationRate = currentPeriodTotal > 0 ? (currentPeriodCancelled / currentPeriodTotal) * 100 : null;

  const stockValue = allProducts.reduce((sum, p) => sum + p.price * p.stock, 0);
  const neverSoldProducts = allProducts.filter((p) => !soldProductIds.has(p.id));

  // Taux de conversion global : approximatif et assumé comme tel (pas de
  // déduplication de vues, `shops.view_count` est un compteur brut depuis le
  // début — migration 0005). Calculé sur la durée de vie de la boutique, pas
  // sur la période choisie, pour rester cohérent avec ce même compteur
  // cumulatif.
  const conversionRate =
    shop?.view_count && shop.view_count > 0
      ? ((totalOrdersCount ?? 0) / shop.view_count) * 100
      : null;

  // Taux de conversion PAR PRODUIT (Pro) : quantité vendue (toute la durée
  // de vie, via le RPC `p_limit` élevé ci-dessus) rapportée aux vues du
  // produit. Filtre `view_count >= 3` : sous ce seuil, un seul achat donne
  // un taux à 50-100% qui n'a aucune signification statistique — bruit
  // écarté plutôt qu'affiché comme un vrai signal.
  const productConversion = allProducts
    .filter((p) => p.view_count >= 3)
    .map((p) => ({
      title: p.title,
      rate: ((lifetimeSales.get(p.id) ?? 0) / p.view_count) * 100,
    }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 5);

  let topCustomers: TopCustomerRow[] = [];
  let customerPeriodStats: CustomerPeriodStats | null = null;

  if (subscription.features.hasFullStats) {
    const [{ data: topCustomersRaw }, { data: customerStatsRaw }] = await Promise.all([
      supabase.rpc("get_shop_top_customers", { p_shop_id: access.shopId, p_limit: 5 }),
      supabase.rpc("get_shop_customer_period_stats", {
        p_shop_id: access.shopId,
        p_since: new Date(currentPeriodStart).toISOString(),
      }),
    ]);
    topCustomers = (topCustomersRaw ?? []) as TopCustomerRow[];
    customerPeriodStats = (customerStatsRaw?.[0] ?? null) as CustomerPeriodStats | null;
  }

  const periodLabel = `${periodDays} derniers jours`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-semibold text-encre">Statistiques</h1>
          <p className="mt-1 text-sm text-encre/70">Vue d&apos;ensemble des {periodLabel}.</p>
        </div>
        <PeriodSelect current={String(periodDays)} />
      </div>

      <div className="mt-6 rounded-lg border border-ligne bg-white p-4">
        <h2 className="font-display text-sm font-semibold text-encre">Chiffre d&apos;affaires</h2>
        <div className="mt-3">
          <RevenueTrendChart points={trendPoints} />
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-ligne bg-white p-4">
        <h2 className="font-display text-sm font-semibold text-encre">Nombre de commandes</h2>
        <div className="mt-3">
          <RevenueTrendChart
            points={orderCountPoints}
            format={(n) => `${n} commande(s)`}
            totalLabel="Total sur la période"
            ariaLabel="Évolution du nombre de commandes"
          />
        </div>
      </div>

      {subscription.features.hasFullStats && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <ComparisonTile
            label={`CA (${periodLabel})`}
            current={currentPeriodRevenue}
            previous={previousPeriodRevenue}
            format={(n) => `${FMT_FCFA.format(n)} FCFA`}
          />
          <ComparisonTile
            label={`Commandes (${periodLabel})`}
            current={currentPeriodOrders}
            previous={previousPeriodOrders}
            format={(n) => String(n)}
          />
          <ComparisonTile
            label="Panier moyen"
            current={currentAvgOrderValue}
            previous={previousAvgOrderValue}
            format={(n) => `${FMT_FCFA.format(Math.round(n))} FCFA`}
          />
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="Panier moyen"
          value={`${FMT_FCFA.format(Math.round(currentAvgOrderValue))} FCFA`}
          sublabel={periodLabel}
        />
        <StatTile
          label="Valeur du stock"
          value={`${FMT_FCFA.format(Math.round(stockValue))} FCFA`}
          sublabel={`${allProducts.length} produit(s) actif(s)`}
        />
        <StatTile
          label="Note moyenne des avis"
          value={rating ? `${rating.average.toFixed(1)} / 5` : "—"}
          sublabel={rating ? `${rating.count} avis` : "Pas encore d'avis"}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
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

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-ligne bg-white p-4">
          <h2 className="font-display text-sm font-semibold text-encre">
            Commandes par statut ({periodLabel})
          </h2>
          <div className="mt-3">
            <StatusBreakdown rows={statusRows} />
          </div>
          {cancellationRate !== null && (
            <p className="mt-3 text-xs text-encre/50">
              Taux d&apos;annulation : <span className="font-mono text-encre/70">{cancellationRate.toFixed(1)}%</span>
            </p>
          )}
        </div>

        <div className="rounded-lg border border-ligne bg-white p-4">
          <h2 className="font-display text-sm font-semibold text-encre">
            CA par moyen de paiement ({periodLabel})
          </h2>
          <div className="mt-3">
            <RevenueBars
              rows={paymentRows}
              emptyLabel="Aucune commande sur cette période."
            />
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-ligne bg-white p-4">
        <h2 className="font-display text-sm font-semibold text-encre">
          CA par catégorie ({periodLabel})
        </h2>
        <div className="mt-3">
          <RevenueBars rows={categoryRows} emptyLabel="Aucune vente sur cette période." />
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-ligne bg-white p-4">
        <h2 className="font-display text-sm font-semibold text-encre">
          Produits jamais vendus
        </h2>
        <p className="mt-1 text-xs text-encre/50">
          Depuis toujours, hors produits inactifs ou supprimés.
        </p>
        <div className="mt-3">
          <RankedList
            items={neverSoldProducts.slice(0, 10).map((p) => ({
              label: p.title,
              value: `${FMT_FCFA.format(p.price)} FCFA`,
            }))}
            emptyLabel="Tous tes produits actifs ont déjà été vendus au moins une fois 🎉"
          />
        </div>
      </div>

      {subscription.features.hasFullStats && (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile
              label="Clients uniques"
              value={String(customerPeriodStats?.unique_customers ?? 0)}
              sublabel={periodLabel}
            />
            <StatTile
              label="Nouveaux clients"
              value={String(customerPeriodStats?.new_customers ?? 0)}
              sublabel={periodLabel}
            />
            <StatTile
              label="Clients récurrents"
              value={String(customerPeriodStats?.returning_customers ?? 0)}
              sublabel={periodLabel}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-ligne bg-white p-4">
              <h2 className="font-display text-sm font-semibold text-encre">
                Meilleurs clients
              </h2>
              <p className="mt-1 text-xs text-encre/50">Par dépense cumulée, depuis toujours.</p>
              <div className="mt-3">
                <RankedList
                  items={topCustomers.map((c) => ({
                    label: `${c.customer_name} (${c.customer_phone})`,
                    value: `${FMT_FCFA.format(c.total_spent)} FCFA · ${c.order_count} commande(s)`,
                  }))}
                  emptyLabel="Pas encore de commande."
                />
              </div>
            </div>

            <div className="rounded-lg border border-ligne bg-white p-4">
              <h2 className="font-display text-sm font-semibold text-encre">
                Meilleurs taux de conversion par produit
              </h2>
              <p className="mt-1 text-xs text-encre/50">
                Vues → ventes, produits avec au moins 3 vues.
              </p>
              <div className="mt-3">
                <RankedList
                  items={productConversion.map((p) => ({
                    label: p.title,
                    value: `${p.rate.toFixed(1)}%`,
                  }))}
                  emptyLabel="Pas encore assez de données."
                />
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-ligne bg-white p-4">
            <h2 className="font-display text-sm font-semibold text-encre">
              Codes promo ({periodLabel})
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <StatTile label="Commandes avec un code" value={String(promoOrdersCount)} />
              <StatTile
                label="Total des remises accordées"
                value={`${FMT_FCFA.format(promoDiscountTotal)} FCFA`}
              />
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-ligne bg-white p-4">
            <h2 className="font-display text-sm font-semibold text-encre">
              Taux de conversion global
            </h2>
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
        </>
      )}
    </div>
  );
}
