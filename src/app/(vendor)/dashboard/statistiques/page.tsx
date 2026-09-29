import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getShopSubscription } from "@/lib/subscription";
import { getAccessibleShop } from "@/lib/shop-access";
import { getShopRating } from "@/lib/reviews";
import { ORDER_STATUS_LABELS, ORDER_STATUS_BAR_CLASS } from "@/lib/orders";
import { ProductImage } from "@/components/product-image";
import {
  StatusBreakdown,
  RankedList,
  ComparisonTile,
  StatTile,
  RevenueBars,
  CountBars,
  CategoryDonut,
} from "./charts";
import { ComboTrendChart } from "./combo-trend-chart";
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
type BestSeller = { product_id: string; title: string; quantity_sold: number; revenue: number };
type ProductImageRow = { url: string; position: number };
type ActiveProduct = {
  id: string;
  title: string;
  price: number;
  stock: number;
  view_count: number;
  product_images: ProductImageRow[];
};
type CategoryRow = { category: string; revenue: number; quantity_sold: number };
type TopCustomerRow = {
  customer_phone: string;
  customer_name: string;
  total_spent: number;
  order_count: number;
};
type CustomerSegments = { nouveau: number; occasionnel: number; regulier: number; fidele: number };
type TrafficSourceRow = { source: string; visits: number };
type PageViewRow = { created_at: string };

const DAY_MS = 24 * 60 * 60 * 1000;
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  mobile_money: "Mobile Money",
  cash_on_delivery: "Paiement à la livraison",
};
// Libellés français — voir migration 0043 pour la liste des canaux reconnus
// côté SQL (`whatsapp`/`instagram`/`facebook`/`tiktok`, sinon "direct").
const TRAFFIC_SOURCE_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  direct: "Lien direct / autre",
};

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function firstThumbnail(images: ProductImageRow[] | undefined): string | undefined {
  if (!images || images.length === 0) return undefined;
  return [...images].sort((a, b) => a.position - b.position)[0]?.url;
}

const FMT_FCFA = new Intl.NumberFormat("fr-FR");

/**
 * "Vraies statistiques" avec graphiques — ajoutée le 16/09/2026, enrichie le
 * même jour, puis refondue en profondeur le 30/09/2026 ("refonte v2") en
 * s'inspirant d'une seconde maquette générique ("Analytiques") qu'Isaac a
 * envoyée après la refonte de l'Aperçu. Voir decisions-techniques.md pour
 * l'historique complet des trois tranches.
 *
 * Deux adaptations honnêtes plutôt que de copier la maquette telle quelle
 * (décisions prises AVANT d'écrire le code, pas des raccourcis découverts en
 * cours de route) :
 * - Pas de "taux de rebond" : `shop_page_views` est un journal de vues à
 *   plat, sans notion de session/visite — impossible de distinguer "reparti
 *   après une page" de "a navigué longtemps". La 4e tuile KPI de la maquette
 *   est remplacée par "Clients actifs" (comptage réel, via le nouveau RPC
 *   `get_shop_customer_segments`).
 * - Entonnoir à 3 étapes, pas 4 : le panier est 100% local au navigateur
 *   (`useShopCart.ts`, aucune persistance serveur pour un visiteur anonyme)
 *   donc "Ajouts panier" est indécidable et abandonné. "Paiements réussis"
 *   devient "Commandes confirmées" (= commandes non annulées) : KEVA n'a pas
 *   d'événement "paiement réussi" distinct de la commande elle-même pour le
 *   paiement à la livraison, qui est le cas majoritaire.
 *
 * Deux niveaux tranchés par Isaac (`subscription.ts`), inchangés par cette
 * refonte :
 * - Business (`hasAdvancedStats`) : sélecteur de période, courbe CA+vues,
 *   entonnoir, top produits (sans conversion%), répartition par
 *   statut/moyen de paiement/catégorie, taux d'annulation, valeur du stock,
 *   produits jamais vendus, note moyenne des avis.
 * - Pro (`hasFullStats`, en plus) : comparaison de périodes sur les tuiles
 *   KPI, taux de conversion et clients actifs, clients par segment,
 *   meilleurs clients, conversion% par produit, statistiques codes promo.
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
  // (Pro), sans deuxième requête sur `orders`/`shop_page_views`.
  const since = new Date(previousPeriodStart);

  const [
    { data: recentOrders },
    { data: pageViewsRaw },
    { data: bestSellersRaw },
    { data: neverSoldRaw },
    { data: allActiveProducts },
    { data: categoryBreakdownRaw },
    { data: trafficSourcesRaw },
    rating,
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, created_at, total_amount, status, payment_method, customer_phone, promo_code_id, discount_amount"
      )
      .eq("shop_id", access.shopId)
      .gte("created_at", since.toISOString()),
    // Vues brutes sur la fenêtre 2x période — bucketées ci-dessous par jour,
    // comme les commandes, pour alimenter à la fois la courbe combinée
    // CA+vues, le taux de conversion (période courante ET précédente) et
    // l'entonnoir ("Visiteurs").
    supabase
      .from("shop_page_views")
      .select("created_at")
      .eq("shop_id", access.shopId)
      .gte("created_at", since.toISOString()),
    // `p_since: null` explicite (30/09/2026, audit technique — bug révélé en
    // reconstituant le schéma pour src/lib/types/database.ts) : DEUX
    // surcharges de `get_shop_best_sellers` coexistent en base, (uuid,
    // integer) de la migration 0025 — jamais supprimée — et (uuid, integer,
    // timestamptz default null) recréée en 0049. Appelée avec seulement
    // `p_shop_id`/`p_limit`, PostgREST trouve deux candidates et répond
    // PGRST203 ("Could not choose the best candidate function"), erreur
    // ignorée ici -> "Top produits" vide et tous les produits comptés comme
    // "jamais vendus". Nommer `p_since` ne laisse qu'une seule candidate, la
    // version 0049 (celle qui renvoie `revenue`), avec exactement le même
    // sens que l'omission : `null` = depuis toujours.
    supabase.rpc("get_shop_best_sellers", { p_shop_id: access.shopId, p_limit: 5, p_since: null }),
    // Limite haute (pas de vrai "top N") : sert uniquement à obtenir
    // l'ensemble complet des produits déjà vendus au moins une fois, pour en
    // déduire par différence les produits jamais vendus ci-dessous.
    // `p_since: null` : même raison que l'appel juste au-dessus.
    supabase.rpc("get_shop_best_sellers", { p_shop_id: access.shopId, p_limit: 10000, p_since: null }),
    supabase
      .from("products")
      .select("id, title, price, stock, view_count, product_images(url, position)")
      .eq("shop_id", access.shopId)
      .eq("is_active", true)
      .is("deleted_at", null),
    supabase.rpc("get_shop_category_breakdown", {
      p_shop_id: access.shopId,
      p_since: new Date(currentPeriodStart).toISOString(),
    }),
    // Trafic par source (22/09/2026, voir migration 0043) — toujours
    // "depuis toujours" (pas borné à la période choisie) : le volume est
    // encore faible pour la plupart des boutiques, une fenêtre glissante
    // n'aurait pour l'instant que peu de valeur ajoutée sur ce chiffre en
    // particulier.
    supabase.rpc("get_shop_traffic_sources", { p_shop_id: access.shopId }),
    getShopRating(supabase, access.shopId),
  ]);

  const orders = (recentOrders ?? []) as OrderRow[];
  const pageViews = (pageViewsRaw ?? []) as PageViewRow[];
  const bestSellers = (bestSellersRaw ?? []) as BestSeller[];
  // Ventes cumulées depuis toujours, par produit — dérivé du même appel
  // `get_shop_best_sellers` à `p_limit` élevé que pour les produits jamais
  // vendus ci-dessous.
  const lifetimeSales = new Map(
    ((neverSoldRaw ?? []) as BestSeller[]).map((p) => [p.product_id, p.quantity_sold])
  );
  const soldProductIds = new Set(lifetimeSales.keys());
  const allProducts = (allActiveProducts ?? []) as ActiveProduct[];
  const productById = new Map(allProducts.map((p) => [p.id, p]));
  const categoryBreakdown = (categoryBreakdownRaw ?? []) as CategoryRow[];
  const trafficSourceRows = ((trafficSourcesRaw ?? []) as TrafficSourceRow[]).map((row) => ({
    label: TRAFFIC_SOURCE_LABELS[row.source] ?? row.source,
    count: row.visits,
  }));

  const dayBuckets = new Map<number, { revenue: number; orders: number; views: number }>();
  for (let i = 0; i < periodDays; i++) {
    dayBuckets.set(currentPeriodStart + i * DAY_MS, { revenue: 0, orders: 0, views: 0 });
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

  let currentPeriodViews = 0;
  let previousPeriodViews = 0;
  for (const view of pageViews) {
    const day = startOfDay(new Date(view.created_at));
    if (day >= currentPeriodStart) {
      currentPeriodViews += 1;
      const bucket = dayBuckets.get(day);
      if (bucket) bucket.views += 1;
    } else if (day >= previousPeriodStart) {
      previousPeriodViews += 1;
    }
  }

  const sortedBuckets = Array.from(dayBuckets.entries()).sort(([a], [b]) => a - b);
  const dayLabel = (ts: number) =>
    new Date(ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

  const comboPoints = sortedBuckets.map(([ts, v]) => ({
    label: dayLabel(ts),
    revenue: v.revenue,
    views: v.views,
  }));
  const revenueTrend = sortedBuckets.map(([, v]) => v.revenue);
  const avgOrderTrend = sortedBuckets.map(([, v]) => (v.orders > 0 ? v.revenue / v.orders : 0));
  const conversionTrend = sortedBuckets.map(([, v]) => (v.views > 0 ? (v.orders / v.views) * 100 : 0));

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

  const categoryRows = categoryBreakdown.map((c) => ({ label: c.category, revenue: c.revenue }));

  const currentAvgOrderValue = currentPeriodOrders > 0 ? currentPeriodRevenue / currentPeriodOrders : 0;
  const previousAvgOrderValue = previousPeriodOrders > 0 ? previousPeriodRevenue / previousPeriodOrders : 0;
  const cancellationRate = currentPeriodTotal > 0 ? (currentPeriodCancelled / currentPeriodTotal) * 100 : null;

  const stockValue = allProducts.reduce((sum, p) => sum + p.price * p.stock, 0);
  const neverSoldProducts = allProducts.filter((p) => !soldProductIds.has(p.id));

  // Taux de conversion — période courante ET précédente, même définition que
  // sur l'Aperçu (commandes / vues) : remplace l'ancien calcul "depuis
  // toujours" (`shops.view_count` / nombre total de commandes), abandonné
  // avec cette refonte au profit d'un chiffre borné à la période choisie,
  // cohérent avec la tuile KPI équivalente de l'Aperçu.
  const currentConversionRate = currentPeriodViews > 0 ? (currentPeriodOrders / currentPeriodViews) * 100 : 0;
  const previousConversionRate = previousPeriodViews > 0 ? (previousPeriodOrders / previousPeriodViews) * 100 : 0;

  // "Top produits" (Business+) : fusionne les anciennes listes séparées
  // "les plus vendus" / "les plus vus" / "meilleurs taux de conversion" en
  // une seule, triée par revenu (depuis toujours — même périmètre que
  // l'ancienne liste "les plus vendus" qu'elle remplace). Filtre
  // `view_count >= 3` sur la conversion% (Pro) : sous ce seuil un seul achat
  // donne un taux de 50-100% qui n'a aucune signification statistique.
  const topProducts = bestSellers.map((p) => {
    const info = productById.get(p.product_id);
    return {
      id: p.product_id,
      title: p.title,
      thumbnail: firstThumbnail(info?.product_images),
      views: info?.view_count ?? 0,
      quantitySold: p.quantity_sold,
      revenue: p.revenue,
      conversion: info && info.view_count >= 3 ? (p.quantity_sold / info.view_count) * 100 : null,
    };
  });

  let topCustomers: TopCustomerRow[] = [];
  let customerSegments: CustomerSegments | null = null;

  if (subscription.features.hasFullStats) {
    const [{ data: topCustomersRaw }, { data: customerSegmentsRaw }] = await Promise.all([
      supabase.rpc("get_shop_top_customers", { p_shop_id: access.shopId, p_limit: 5 }),
      supabase.rpc("get_shop_customer_segments", {
        p_shop_id: access.shopId,
        p_since: new Date(currentPeriodStart).toISOString(),
      }),
    ]);
    topCustomers = (topCustomersRaw ?? []) as TopCustomerRow[];
    customerSegments = (customerSegmentsRaw?.[0] ?? null) as CustomerSegments | null;
  }

  const activeCustomersCount = customerSegments
    ? customerSegments.nouveau + customerSegments.occasionnel + customerSegments.regulier + customerSegments.fidele
    : 0;

  // Entonnoir simplifié à 3 étapes — voir le commentaire en tête de fichier
  // pour le raisonnement (panier local au navigateur, pas d'événement
  // "paiement réussi" distinct de la commande pour le paiement à la
  // livraison).
  const funnelStages = [
    { label: "Visiteurs", count: currentPeriodViews },
    { label: "Commandes", count: currentPeriodTotal },
    { label: "Commandes confirmées", count: currentPeriodOrders },
  ];
  const funnelMax = Math.max(1, funnelStages[0].count);

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

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {subscription.features.hasFullStats ? (
          <>
            <ComparisonTile
              label="Chiffre d'affaires"
              current={currentPeriodRevenue}
              previous={previousPeriodRevenue}
              format={(n) => `${FMT_FCFA.format(n)} FCFA`}
              icon={<IconRevenue className="h-4.5 w-4.5" />}
              trend={revenueTrend}
            />
            <ComparisonTile
              label="Panier moyen"
              current={currentAvgOrderValue}
              previous={previousAvgOrderValue}
              format={(n) => `${FMT_FCFA.format(Math.round(n))} FCFA`}
              icon={<IconBasket className="h-4.5 w-4.5" />}
              trend={avgOrderTrend}
            />
            <ComparisonTile
              label="Taux de conversion"
              current={currentConversionRate}
              previous={previousConversionRate}
              format={(n) => `${n.toFixed(1)}%`}
              icon={<IconTarget className="h-4.5 w-4.5" />}
              trend={conversionTrend}
            />
            <StatTile
              label="Clients actifs"
              value={String(activeCustomersCount)}
              sublabel={periodLabel}
              icon={<IconUsersActive className="h-4.5 w-4.5" />}
            />
          </>
        ) : (
          <>
            <StatTile
              label="Chiffre d'affaires"
              value={`${FMT_FCFA.format(currentPeriodRevenue)} FCFA`}
              sublabel={periodLabel}
              icon={<IconRevenue className="h-4.5 w-4.5" />}
              trend={revenueTrend}
            />
            <StatTile
              label="Panier moyen"
              value={`${FMT_FCFA.format(Math.round(currentAvgOrderValue))} FCFA`}
              sublabel={periodLabel}
              icon={<IconBasket className="h-4.5 w-4.5" />}
              trend={avgOrderTrend}
            />
            <div className="col-span-2 flex items-center rounded-md border border-dashed border-ligne bg-brume px-3 py-2 text-xs text-encre/60 sm:col-span-2">
              Le taux de conversion et les clients actifs sont disponibles avec
              le plan Pro.
            </div>
          </>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-ligne bg-white p-4">
        <h2 className="font-display text-sm font-semibold text-encre">
          Ventes &amp; vues ({periodLabel})
        </h2>
        <div className="mt-3">
          <ComboTrendChart points={comboPoints} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-ligne bg-white p-4">
          <h2 className="font-display text-sm font-semibold text-encre">
            Entonnoir de conversion ({periodLabel})
          </h2>
          <p className="mt-1 text-xs text-encre/50">
            Simplifié à 3 étapes : KEVA ne peut pas suivre les ajouts au
            panier (panier local au navigateur), et &quot;Commandes
            confirmées&quot; remplace &quot;Paiements réussis&quot; — pas
            d&apos;étape de paiement distincte pour une commande à la
            livraison.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            {funnelStages.map((stage, i) => {
              const widthPct = Math.max(4, (stage.count / funnelMax) * 100);
              const previous = i > 0 ? funnelStages[i - 1].count : null;
              const dropOff =
                previous !== null && previous > 0 ? ((previous - stage.count) / previous) * 100 : null;
              return (
                <div key={stage.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-encre/70">{stage.label}</span>
                    <span className="font-mono text-encre">{stage.count}</span>
                  </div>
                  <div className="mt-1 h-3 overflow-hidden rounded-full bg-brume">
                    <div className="h-full rounded-full bg-vert-actif" style={{ width: `${widthPct}%` }} />
                  </div>
                  {dropOff !== null && (
                    <p className="mt-1 text-[11px] text-encre/45">
                      {dropOff <= 0 ? "Aucune perte" : `-${dropOff.toFixed(0)}% vs étape précédente`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-ligne bg-white p-4">
          <h2 className="font-display text-sm font-semibold text-encre">
            CA par catégorie ({periodLabel})
          </h2>
          <div className="mt-3">
            <CategoryDonut rows={categoryRows} emptyLabel="Aucune vente sur cette période." />
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-ligne bg-white p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-sm font-semibold text-encre">Top produits</h2>
          <p className="text-xs text-encre/50">Depuis toujours</p>
        </div>
        {topProducts.length === 0 ? (
          <p className="mt-3 text-sm text-encre/60">Aucune vente pour l&apos;instant.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ligne">
            {topProducts.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <ProductImage src={p.thumbnail} alt={p.title} className="h-10 w-10 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-encre">{p.title}</p>
                  <p className="text-xs text-encre/50">
                    {p.views} vue(s) · {p.quantitySold} vendu(s)
                    {subscription.features.hasFullStats && p.conversion !== null && (
                      <> · {p.conversion.toFixed(1)}% conversion</>
                    )}
                  </p>
                </div>
                <p className="shrink-0 font-mono text-sm text-vert-actif">
                  {FMT_FCFA.format(p.revenue)} FCFA
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-ligne bg-white p-4">
        <h2 className="font-display text-sm font-semibold text-encre">
          Trafic par source (depuis toujours)
        </h2>
        <p className="mt-1 text-xs text-encre/50">
          Génère des liens à partager par réseau depuis « Ma boutique ».
        </p>
        <div className="mt-3">
          <CountBars
            rows={trafficSourceRows}
            emptyLabel="Aucune visite via un lien suivi pour l'instant."
          />
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

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-ligne bg-white p-4">
          <h2 className="font-display text-sm font-semibold text-encre">Valeur du stock</h2>
          <p className="mt-1 font-mono text-lg font-semibold text-encre">
            {FMT_FCFA.format(Math.round(stockValue))} FCFA
          </p>
          <p className="mt-0.5 text-xs text-encre/50">{allProducts.length} produit(s) actif(s)</p>
        </div>
        <div className="rounded-lg border border-ligne bg-white p-4">
          <h2 className="font-display text-sm font-semibold text-encre">Note moyenne des avis</h2>
          <p className="mt-1 font-mono text-lg font-semibold text-encre">
            {rating ? `${rating.average.toFixed(1)} / 5` : "—"}
          </p>
          <p className="mt-0.5 text-xs text-encre/50">
            {rating ? `${rating.count} avis` : "Pas encore d'avis"}
          </p>
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
          <div className="mt-4 rounded-lg border border-ligne bg-white p-4">
            <h2 className="font-display text-sm font-semibold text-encre">
              Clients par segment
            </h2>
            <p className="mt-1 text-xs text-encre/50">
              Parmi les clients ayant commandé sur la période, selon leur
              nombre de commandes cumulé depuis toujours.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Nouveaux" value={String(customerSegments?.nouveau ?? 0)} />
              <StatTile label="Occasionnels" value={String(customerSegments?.occasionnel ?? 0)} />
              <StatTile label="Réguliers" value={String(customerSegments?.regulier ?? 0)} />
              <StatTile label="Fidèles" value={String(customerSegments?.fidele ?? 0)} />
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-ligne bg-white p-4">
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
        </>
      )}
    </div>
  );
}

function IconRevenue(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v9M14.5 9.8c0-1-1-1.8-2.5-1.8s-2.5.8-2.5 1.8 1 1.5 2.5 1.8 2.5.8 2.5 1.9-1 1.8-2.5 1.8-2.5-.7-2.5-1.7" />
    </svg>
  );
}

function IconBasket(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 9.5h16l-1.4 9.3a2 2 0 0 1-2 1.7H7.4a2 2 0 0 1-2-1.7L4 9.5Z" />
      <path d="M8 9.5V8a4 4 0 0 1 8 0v1.5" />
    </svg>
  );
}

function IconTarget(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconUsersActive(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5" />
      <circle cx="17" cy="8.5" r="2.3" />
      <path d="M15.7 14.7c2.4.5 4.3 2.5 4.3 5.3" />
    </svg>
  );
}
