import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleShop } from "@/lib/shop-access";
import { getShopSubscription } from "@/lib/subscription";
import { LOW_STOCK_THRESHOLD } from "@/lib/products";
import { ORDER_STATUS_LABELS, ORDER_STATUS_BADGE_CLASS } from "@/lib/orders";
import { ProductImage } from "@/components/product-image";
import { RevenueTrendChart, ComparisonTile, StatTile, CountBars } from "./statistiques/charts";
import { PeriodSelect } from "./statistiques/period-select";

// Même ordre de grandeur que le `PAGE_SIZE` des listes paginées du dashboard
// vendeur/admin (30/09/2026, audit technique — voir
// audit-technique-2026-09-29.md) : la requête `lowStockProducts` plus bas
// chargeait tout le catalogue actif d'une boutique, triée par stock croissant,
// pour n'en retenir que ceux sous le seuil d'alerte. Comme le tri place déjà
// les stocks les plus bas en tête, plafonner à ce nombre ne peut manquer une
// alerte réelle que pour une boutique cumulant plus de
// `LOW_STOCK_ALERTS_LIMIT` produits sous le seuil en même temps — un cas
// limite acceptable pour ce widget d'aperçu, largement compensé par l'aller
// simple en base évité pour les boutiques à gros catalogue.
const LOW_STOCK_ALERTS_LIMIT = 50;

/**
 * Aperçu du dashboard vendeur — refondu le 29/09/2026 sur inspiration d'une
 * maquette générique envoyée par Isaac ("on change notre dashboard").
 * Remplace les 4 tuiles plates + liste de commandes brute d'origine
 * (13/09/2026) par : un sélecteur de période (7/30/90 jours, réutilise
 * `PeriodSelect` de `/dashboard/statistiques`) qui pilote maintenant TOUS
 * les chiffres de la page — les trois fenêtres fixes "aujourd'hui/semaine/
 * mois" de l'ancienne version disparaissent, remplacées par une seule
 * période choisie ; des tuiles avec icône (même puce `bg-brume`/
 * `text-vert-actif` que l'argumentaire de confiance de la marketplace
 * publique, pas une couleur par tuile comme la maquette — voir charts.tsx) ;
 * une vraie courbe de ventes et une répartition du trafic par source (déjà
 * construites pour `/dashboard/statistiques`, jamais réutilisées ici avant
 * aujourd'hui) ; des vignettes produit sur les commandes récentes et les
 * alertes de stock.
 *
 * **Palier d'abonnement — décision prise avec Isaac avant de coder** : une
 * partie de ce qui existe sur `/dashboard/statistiques` (courbe de CA,
 * trafic par source, comparaison vs période précédente, taux de conversion,
 * clients actifs) est réservée aux plans Business/Pro. L'Aperçu, lui, est
 * visible par TOUS les vendeurs quel que soit leur plan — le mettre à
 * disposition ici sans condition aurait donné gratuitement une
 * fonctionnalité payante. Choix retenu : mêmes paliers que Statistiques.
 * - Tous les plans : les 4 tuiles de base (CA, commandes, vues, panier
 *   moyen — sur la période choisie), les alertes de stock, les commandes
 *   récentes.
 * - Business+ (`hasAdvancedStats`) : courbe de ventes + trafic par source,
 *   sinon un encart "disponible à partir du plan Business".
 * - Pro (`hasFullStats`) : les 3 tuiles de base ci-dessus gagnent une
 *   comparaison vs période précédente (`ComparisonTile`, déjà utilisé sur
 *   Statistiques), + 2 tuiles supplémentaires (taux de conversion, clients
 *   actifs), sinon un encart "disponible avec le plan Pro".
 *
 * Taux de conversion = commandes non annulées / vues de la boutique sur la
 * période (`shop_page_views`, incrémenté à CHAQUE visite boutique quel que
 * soit le canal — voir migration 0043 — donc une vraie mesure des visites de
 * la période, pas seulement celles venues d'un lien suivi). Clients actifs =
 * `get_shop_customer_period_stats` (déjà utilisé sur Statistiques,
 * `unique_customers`) — jamais un chiffre réinventé ici.
 */

type RecentOrder = {
  id: string;
  customer_name: string;
  status: string;
  total_amount: number;
  created_at: string;
};

type LowStockProduct = {
  id: string;
  title: string;
  stock: number;
  stock_alert_threshold: number | null;
  product_images: { url: string; position: number }[];
};

type OrderWindowRow = {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
};

type OrderItemThumbRow = {
  order_id: string;
  quantity: number;
  product: { title: string; product_images: { url: string; position: number }[] } | null;
};

type CustomerPeriodStats = { unique_customers: number };
type TrafficSourceRow = { source: string; visits: number };

const TRAFFIC_SOURCE_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  direct: "Lien direct / autre",
};

const DAY_MS = 24 * 60 * 60 * 1000;
const FMT_FCFA = new Intl.NumberFormat("fr-FR");

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function firstThumbnail(images: { url: string; position: number }[]): string | undefined {
  return [...images].sort((a, b) => a.position - b.position)[0]?.url;
}

// Aperçu vendeur : vues boutique, nombre de commandes, CA, commandes
// récentes, alertes stock bas (cf. cahier des charges §3.1.A.4).
export default async function DashboardOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Aperçu accessible à un collaborateur actif (plan Pro), pas seulement au
  // propriétaire — voir src/lib/shop-access.ts.
  const access = user ? await getAccessibleShop(supabase, user.id) : null;

  // Pas encore de boutique : on guide le vendeur vers la création avant de
  // lui montrer des statistiques vides.
  if (!access) {
    redirect("/dashboard/boutique");
  }

  const { data: shop } = await supabase
    .from("shops")
    .select("id, name")
    .eq("id", access.shopId)
    .maybeSingle();

  if (!shop) {
    redirect("/dashboard/boutique");
  }

  const subscription = await getShopSubscription(supabase, shop.id);

  // Même sélecteur, même bornes 7/30/90 jours que `/dashboard/statistiques`
  // (voir period-select.tsx) — 30 jours par défaut.
  const { periode } = await searchParams;
  const periodDays = periode === "7" || periode === "90" ? parseInt(periode, 10) : 30;
  const periodLabel = `${periodDays} derniers jours`;

  const todayStart = startOfDay(new Date());
  const currentPeriodStart = todayStart - (periodDays - 1) * DAY_MS;
  const previousPeriodStart = currentPeriodStart - periodDays * DAY_MS;
  const since = new Date(previousPeriodStart);

  const [
    { data: windowOrders },
    { count: periodViews },
    { data: recentOrders },
    { data: lowStockProducts },
    trafficResult,
    customerStatsResult,
  ] = await Promise.all([
    // Fenêtre = 2x la période choisie, même motif que Statistiques : la
    // moitié récente sert aux tuiles/à la courbe affichées, l'autre moitié
    // à la comparaison de périodes (Pro) — une seule requête `orders`.
    supabase
      .from("orders")
      .select("id, created_at, total_amount, status")
      .eq("shop_id", shop.id)
      .gte("created_at", since.toISOString()),
    supabase
      .from("shop_page_views")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shop.id)
      .gte("created_at", new Date(currentPeriodStart).toISOString()),
    supabase
      .from("orders")
      .select("id, customer_name, status, total_amount, created_at")
      .eq("shop_id", shop.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("products")
      .select("id, title, stock, stock_alert_threshold, product_images(url, position)")
      .eq("shop_id", shop.id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("stock", { ascending: true })
      .limit(LOW_STOCK_ALERTS_LIMIT),
    // Business+ seulement — pas de requête pour un plan qui ne l'affichera
    // pas (même discipline que `/dashboard/statistiques`).
    subscription.features.hasAdvancedStats
      ? supabase.rpc("get_shop_traffic_sources", { p_shop_id: shop.id })
      : Promise.resolve({ data: null }),
    subscription.features.hasFullStats
      ? supabase.rpc("get_shop_customer_period_stats", {
          p_shop_id: shop.id,
          p_since: new Date(currentPeriodStart).toISOString(),
        })
      : Promise.resolve({ data: null }),
  ]);

  const orders = (windowOrders ?? []) as OrderWindowRow[];
  const dayBuckets = new Map<number, number>();
  for (let i = 0; i < periodDays; i++) {
    dayBuckets.set(currentPeriodStart + i * DAY_MS, 0);
  }

  let periodRevenue = 0;
  let periodOrders = 0;
  let previousPeriodRevenue = 0;
  let previousPeriodOrders = 0;

  // CA/commandes = commandes non annulées, même définition que partout
  // ailleurs dans le projet (Statistiques, relevé de paiements).
  for (const order of orders) {
    if (order.status === "cancelled") continue;
    const day = startOfDay(new Date(order.created_at));
    if (day >= currentPeriodStart) {
      periodRevenue += order.total_amount;
      periodOrders += 1;
      const bucket = dayBuckets.get(day);
      if (bucket !== undefined) dayBuckets.set(day, bucket + order.total_amount);
    } else if (day >= previousPeriodStart) {
      previousPeriodRevenue += order.total_amount;
      previousPeriodOrders += 1;
    }
  }

  const trendPoints = Array.from(dayBuckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([ts, revenue]) => ({
      label: new Date(ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
      value: revenue,
    }));

  const periodAvgOrderValue = periodOrders > 0 ? periodRevenue / periodOrders : 0;
  const previousAvgOrderValue = previousPeriodOrders > 0 ? previousPeriodRevenue / previousPeriodOrders : 0;
  const conversionRate =
    periodViews && periodViews > 0 ? (periodOrders / periodViews) * 100 : null;

  const trafficSourceRows = ((trafficResult.data ?? []) as TrafficSourceRow[]).map((row) => ({
    label: TRAFFIC_SOURCE_LABELS[row.source] ?? row.source,
    count: row.visits,
  }));
  const customerStats = (customerStatsResult.data?.[0] ?? null) as CustomerPeriodStats | null;

  // Vignette produit des commandes récentes — deuxième requête (a besoin des
  // `id` de `recentOrders`), jamais une jointure imbriquée dans la requête
  // `orders` ci-dessus : une commande peut avoir plusieurs articles, un seul
  // suffit ici pour l'aperçu (voir `firstThumbnail`/regroupement ci-dessous).
  const recentOrderIds = (recentOrders ?? []).map((o) => o.id);
  const { data: orderItemsRaw } = recentOrderIds.length
    ? await supabase
        .from("order_items")
        .select("order_id, quantity, product:products(title, product_images(url, position))")
        .in("order_id", recentOrderIds)
    : { data: [] as OrderItemThumbRow[] };

  const itemsByOrder = new Map<string, OrderItemThumbRow[]>();
  for (const row of (orderItemsRaw ?? []) as OrderItemThumbRow[]) {
    const list = itemsByOrder.get(row.order_id) ?? [];
    list.push(row);
    itemsByOrder.set(row.order_id, list);
  }

  const lowStockAlerts = ((lowStockProducts as LowStockProduct[] | null) ?? []).filter(
    (p) => p.stock <= (p.stock_alert_threshold ?? LOW_STOCK_THRESHOLD)
  );
  const lowStockMaxScale = Math.max(LOW_STOCK_THRESHOLD, ...lowStockAlerts.map((p) => p.stock_alert_threshold ?? LOW_STOCK_THRESHOLD)) || 1;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-semibold text-encre">Aperçu</h1>
          <p className="mt-1 text-sm text-encre/70">Vue d&apos;ensemble des {periodLabel}.</p>
        </div>
        <PeriodSelect current={String(periodDays)} basePath="/dashboard" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {subscription.features.hasFullStats ? (
          <>
            <ComparisonTile
              label="Revenu"
              current={periodRevenue}
              previous={previousPeriodRevenue}
              format={(n) => `${FMT_FCFA.format(n)} FCFA`}
              icon={<IconRevenue className="h-4 w-4" />}
            />
            <ComparisonTile
              label="Commandes"
              current={periodOrders}
              previous={previousPeriodOrders}
              format={(n) => String(n)}
              icon={<IconOrders className="h-4 w-4" />}
            />
          </>
        ) : (
          <>
            <StatTile
              label="Revenu"
              value={`${FMT_FCFA.format(periodRevenue)} FCFA`}
              sublabel={periodLabel}
              icon={<IconRevenue className="h-4 w-4" />}
            />
            <StatTile
              label="Commandes"
              value={String(periodOrders)}
              sublabel={periodLabel}
              icon={<IconOrders className="h-4 w-4" />}
            />
          </>
        )}
        <StatTile
          label="Vues de la boutique"
          value={String(periodViews ?? 0)}
          sublabel={periodLabel}
          icon={<IconEye className="h-4 w-4" />}
        />
        {subscription.features.hasFullStats ? (
          <ComparisonTile
            label="Panier moyen"
            current={periodAvgOrderValue}
            previous={previousAvgOrderValue}
            format={(n) => `${FMT_FCFA.format(Math.round(n))} FCFA`}
            icon={<IconBasket className="h-4 w-4" />}
          />
        ) : (
          <StatTile
            label="Panier moyen"
            value={`${FMT_FCFA.format(Math.round(periodAvgOrderValue))} FCFA`}
            sublabel={periodLabel}
            icon={<IconBasket className="h-4 w-4" />}
          />
        )}
      </div>

      {subscription.features.hasFullStats ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <StatTile
            label="Taux de conversion"
            value={conversionRate === null ? "—" : `${conversionRate.toFixed(1)}%`}
            sublabel={
              conversionRate === null
                ? "Pas encore assez de vues"
                : `${periodOrders} commande(s) / ${periodViews} vue(s)`
            }
            icon={<IconTarget className="h-4 w-4" />}
          />
          <StatTile
            label="Clients actifs"
            value={String(customerStats?.unique_customers ?? 0)}
            sublabel={periodLabel}
            icon={<IconUsersActive className="h-4 w-4" />}
          />
        </div>
      ) : (
        <p className="mt-3 rounded-md border border-dashed border-ligne bg-brume px-3 py-2 text-xs text-encre/60">
          Le taux de conversion, les clients actifs et la comparaison vs
          période précédente sont disponibles avec le plan{" "}
          <Link href="/dashboard/abonnement" className="font-medium text-vert-actif underline">
            Pro
          </Link>
          .
        </p>
      )}

      {subscription.features.hasAdvancedStats ? (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-ligne bg-white p-4">
            <h2 className="font-display text-sm font-semibold text-encre">
              Ventes ({periodLabel})
            </h2>
            <div className="mt-3">
              <RevenueTrendChart points={trendPoints} />
            </div>
          </div>
          <div className="rounded-lg border border-ligne bg-white p-4">
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
        </div>
      ) : (
        <p className="mt-4 rounded-md border border-dashed border-ligne bg-brume px-3 py-2 text-xs text-encre/60">
          La courbe de ventes et la répartition du trafic par source sont
          disponibles à partir du plan{" "}
          <Link href="/dashboard/abonnement" className="font-medium text-vert-actif underline">
            Business
          </Link>
          .
        </p>
      )}

      {lowStockAlerts.length > 0 && (
        <div className="mt-6 rounded-lg border border-attention/30 bg-attention/10 p-4">
          <h2 className="font-display text-sm font-semibold text-attention">Stock bas</h2>
          <ul className="mt-2 space-y-2">
            {lowStockAlerts.map((product) => {
              const threshold = product.stock_alert_threshold ?? LOW_STOCK_THRESHOLD;
              const pct = Math.max(6, Math.min(100, (product.stock / lowStockMaxScale) * 100));
              return (
                <li key={product.id} className="flex items-center gap-3">
                  <ProductImage
                    src={firstThumbnail(product.product_images)}
                    alt={product.title}
                    className="h-10 w-10 shrink-0 rounded-md"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-encre">{product.title}</span>
                      <span className="shrink-0 text-encre/70">
                        {product.stock} en stock
                        <span className="text-encre/45"> (seuil : {threshold})</span>
                      </span>
                    </div>
                    <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-white">
                      <span
                        className="block h-full rounded-full bg-erreur"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          <Link
            href="/dashboard/produits"
            className="mt-3 inline-block text-sm font-medium text-attention underline"
          >
            Gérer les stocks
          </Link>
        </div>
      )}

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-encre">Commandes récentes</h2>
          <Link
            href="/dashboard/commandes"
            className="text-sm text-encre/60 underline hover:text-vert-sapin"
          >
            Voir tout
          </Link>
        </div>

        {(recentOrders ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-encre/70">Aucune commande pour l&apos;instant.</p>
        ) : (
          <ul className="mt-2 divide-y divide-ligne">
            {(recentOrders as RecentOrder[]).map((order) => {
              const items = itemsByOrder.get(order.id) ?? [];
              const first = items[0]?.product;
              const extraCount = items.length - 1;
              return (
                <li key={order.id} className="py-3">
                  <Link
                    href={`/dashboard/commandes/${order.id}`}
                    className="flex items-center gap-3"
                  >
                    <ProductImage
                      src={first ? firstThumbnail(first.product_images) : undefined}
                      alt={first?.title ?? order.customer_name}
                      className="h-11 w-11 shrink-0 rounded-md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-encre">
                        {first?.title ?? "Commande"}
                        {extraCount > 0 && (
                          <span className="ml-1 font-normal text-encre/50">
                            + {extraCount} autre{extraCount > 1 ? "s" : ""}
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-encre/60">
                        {order.customer_name} ·{" "}
                        {new Date(order.created_at).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-sm text-vert-actif">
                        {order.total_amount} FCFA
                      </p>
                      <span
                        className={`mt-1 inline-block rounded px-1.5 py-0.5 text-xs ${
                          ORDER_STATUS_BADGE_CLASS[order.status] ?? "bg-brume text-encre/70"
                        }`}
                      >
                        {ORDER_STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
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
function IconOrders(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  );
}
function IconEye(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.75" />
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
