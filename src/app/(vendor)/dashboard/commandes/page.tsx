import Link from "next/link";
import { ViewTransition } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getShopSubscription } from "@/lib/subscription";
import { getAccessibleShop } from "@/lib/shop-access";
import { ORDER_STATUS_LABELS, ORDER_STATUS_BADGE_CLASS } from "@/lib/orders";
import { ProductImage } from "@/components/product-image";

const PAGE_SIZE = 50;
// Une commande "en attente" plus vieille que ce seuil apparaît dans le
// panneau "Commandes urgentes" ci-dessous.
const URGENT_PENDING_HOURS = 2;
const HOUR_MS = 60 * 60 * 1000;

type Order = {
  id: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  total_amount: number;
  created_at: string;
};
type UrgentOrder = { id: string; customer_name: string; created_at: string };
type ProductImageRow = { url: string; position: number };
type OrderItemThumbRow = {
  order_id: string;
  quantity: number;
  product: { title: string; product_images: ProductImageRow[] } | null;
};

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "", label: "Toutes" },
  ...Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

const FMT_FCFA = new Intl.NumberFormat("fr-FR");

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function firstThumbnail(images: ProductImageRow[] | undefined): string | undefined {
  if (!images || images.length === 0) return undefined;
  return [...images].sort((a, b) => a.position - b.position)[0]?.url;
}

function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / HOUR_MS;
}

// Échappe les caractères spéciaux ILIKE (% et _) — même helper que côté admin
// (src/app/(admin)/admin/vendeurs/page.tsx).
function escapeIlike(value: string): string {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}

/**
 * Liste des commandes (En attente, Payée, En préparation, Livrée, Annulée)
 * + détail, changement de statut, contact WhatsApp client. cf. §3.1.A.5.
 *
 * **Recherche + filtre + pagination ajoutés le 22/09/2026**, puis **refondue
 * le 30/09/2026** ("refonte v2") en s'inspirant d'une maquette générique
 * ("Lumina Store") qu'Isaac a envoyée. Trois adaptations décidées AVEC Isaac
 * avant d'écrire le code (AskUserQuestion) plutôt que devinées :
 * - Pas de bouton "Nouvelle commande" : chez KEVA les commandes viennent
 *   uniquement des clients via la boutique — créer une commande à la main
 *   (choix produits, calcul du prix, stock...) est un vrai chantier à part,
 *   volontairement laissé de côté pour cette passe.
 * - Les pastilles de statut reprennent les 5 VRAIS statuts de KEVA (En
 *   attente / Payée / En préparation / Livrée / Annulée) — la maquette
 *   suppose une étape "Expédiée" distincte que KEVA ne suit pas (pas de
 *   notion d'expédition séparée de la livraison, voir migration 0001).
 * - "Taux de satisfaction" (un CSAT que KEVA ne mesure pas) devient "Taux de
 *   livraison" (commandes livrées / total non annulé, un vrai chiffre).
 *   "Conseil du jour" (texte fixe présenté comme une IA dans la maquette)
 *   est retiré plutôt que fabriqué.
 *
 * Compteurs des tuiles KPI et des pastilles de statut : toujours "depuis
 * toujours" (pas bornés par la recherche/le filtre de dates ci-dessous) —
 * ce sont des indicateurs globaux de l'activité de la boutique, pas un
 * résumé de la vue filtrée. Seule la LISTE ci-dessous respecte les filtres.
 */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string; page?: string; du?: string; au?: string }>;
}) {
  const { q, statut: statusParam, page: pageParam, du, au } = await searchParams;
  const trimmedQuery = q?.trim() || undefined;
  const status = statusParam && statusParam in ORDER_STATUS_LABELS ? statusParam : "";
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Bornes de dates (nouveau, 30/09/2026) : `du`/`au` viennent de deux
  // `<input type="date">`, donc des dates locales sans heure — `au` est
  // porté à 23:59:59.999 pour inclure toute la journée choisie.
  const dateFromIso = du ? new Date(`${du}T00:00:00`).toISOString() : null;
  const dateToIso = au ? new Date(`${au}T23:59:59.999`).toISOString() : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Accessible à un collaborateur actif (plan Pro), pas seulement au
  // propriétaire — voir src/lib/shop-access.ts.
  const access = user ? await getAccessibleShop(supabase, user.id) : null;

  if (!access) {
    redirect("/dashboard/boutique");
  }

  const ORDER_SELECT = "id, customer_name, customer_phone, status, total_amount, created_at";
  const shopId = access.shopId;
  const todayStart = new Date(startOfDay(new Date())).toISOString();

  // Lancées en parallèle des requêtes de liste ci-dessous (aucune dépendance
  // entre les deux) : abonnement, compteurs par statut (tuiles KPI +
  // pastilles), commande(s) urgente(s).
  const subscriptionPromise = getShopSubscription(supabase, shopId);
  const statusCountPromises = Promise.all(
    Object.keys(ORDER_STATUS_LABELS).map((s) =>
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("shop_id", shopId).eq("status", s)
    )
  );
  const todayCountPromise = supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId)
    .gte("created_at", todayStart);
  const deliveredTodayCountPromise = supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId)
    .eq("status", "delivered")
    .gte("updated_at", todayStart);
  const urgentOrdersPromise = supabase
    .from("orders")
    .select("id, customer_name, created_at")
    .eq("shop_id", shopId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(5);

  let orders: Order[] | null = null;
  let ordersCount: number | null = null;

  if (trimmedQuery) {
    const escaped = escapeIlike(trimmedQuery);
    let byName = supabase
      .from("orders")
      .select(ORDER_SELECT, { count: "exact" })
      .eq("shop_id", shopId)
      .ilike("customer_name", `%${escaped}%`);
    let byPhone = supabase
      .from("orders")
      .select(ORDER_SELECT, { count: "exact" })
      .eq("shop_id", shopId)
      .ilike("customer_phone", `%${escaped}%`);
    if (status) {
      byName = byName.eq("status", status);
      byPhone = byPhone.eq("status", status);
    }
    if (dateFromIso) {
      byName = byName.gte("created_at", dateFromIso);
      byPhone = byPhone.gte("created_at", dateFromIso);
    }
    if (dateToIso) {
      byName = byName.lte("created_at", dateToIso);
      byPhone = byPhone.lte("created_at", dateToIso);
    }
    const [nameRes, phoneRes] = await Promise.all([
      byName.order("created_at", { ascending: false }).range(from, to),
      byPhone.order("created_at", { ascending: false }).range(from, to),
    ]);
    const merged = new Map<string, Order>();
    for (const row of [...(nameRes.data ?? []), ...(phoneRes.data ?? [])] as Order[]) {
      merged.set(row.id, row);
    }
    orders = [...merged.values()].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    // Approximation assumée (même choix que /admin/commandes) : le plus
    // grand des deux comptes, pas un vrai total distinct.
    ordersCount = Math.max(nameRes.count ?? 0, phoneRes.count ?? 0);
  } else {
    let query = supabase
      .from("orders")
      .select(ORDER_SELECT, { count: "exact" })
      .eq("shop_id", shopId);
    if (status) query = query.eq("status", status);
    if (dateFromIso) query = query.gte("created_at", dateFromIso);
    if (dateToIso) query = query.lte("created_at", dateToIso);
    const { data, count } = await query.order("created_at", { ascending: false }).range(from, to);
    orders = data as Order[] | null;
    ordersCount = count;
  }

  const totalPages = ordersCount ? Math.ceil(ordersCount / PAGE_SIZE) : 1;

  // Vignette produit par commande (30/09/2026) — même technique que sur
  // l'Aperçu du dashboard : une requête séparée sur `order_items`, une fois
  // les commandes de la page courante connues, plutôt que de l'imbriquer
  // dans la requête `orders` ci-dessus (qui a deux variantes : recherche
  // fusionnée vs filtre simple).
  const orderIds = (orders ?? []).map((o) => o.id);
  const itemsByOrder = new Map<string, OrderItemThumbRow[]>();
  if (orderIds.length > 0) {
    const { data: itemsRaw } = await supabase
      .from("order_items")
      .select("order_id, quantity, product:products(title, product_images(url, position))")
      .in("order_id", orderIds);
    for (const row of (itemsRaw ?? []) as unknown as OrderItemThumbRow[]) {
      const list = itemsByOrder.get(row.order_id) ?? [];
      list.push(row);
      itemsByOrder.set(row.order_id, list);
    }
  }

  const [subscription, statusCountResults, todayCountRes, deliveredTodayRes, urgentOrdersRes] = await Promise.all([
    subscriptionPromise,
    statusCountPromises,
    todayCountPromise,
    deliveredTodayCountPromise,
    urgentOrdersPromise,
  ]);

  const statusCounts = new Map<string, number>();
  Object.keys(ORDER_STATUS_LABELS).forEach((s, i) => {
    statusCounts.set(s, statusCountResults[i].count ?? 0);
  });
  const totalOrdersEver = Array.from(statusCounts.values()).reduce((sum, n) => sum + n, 0);
  const deliveredEver = statusCounts.get("delivered") ?? 0;
  const cancelledEver = statusCounts.get("cancelled") ?? 0;
  const deliveryRate =
    totalOrdersEver - cancelledEver > 0 ? (deliveredEver / (totalOrdersEver - cancelledEver)) * 100 : null;

  const pendingCount = statusCounts.get("pending") ?? 0;
  const todayCount = todayCountRes.count ?? 0;
  const deliveredTodayCount = deliveredTodayRes.count ?? 0;
  const urgentOrders = ((urgentOrdersRes.data ?? []) as UrgentOrder[]).filter(
    (o) => hoursSince(o.created_at) >= URGENT_PENDING_HOURS
  );

  // Reconstruit la query string en préservant les filtres actifs — utilisé à
  // la fois par les pastilles de statut et par la pagination.
  const buildQuery = (overrides: { statut?: string; page?: string }) => {
    const merged = { q: trimmedQuery, statut: status, du, au, page: undefined as string | undefined, ...overrides };
    const params = new URLSearchParams();
    if (merged.q) params.set("q", merged.q);
    if (merged.statut) params.set("statut", merged.statut);
    if (merged.du) params.set("du", merged.du);
    if (merged.au) params.set("au", merged.au);
    if (merged.page) params.set("page", merged.page);
    const qs = params.toString();
    return qs ? `/dashboard/commandes?${qs}` : "/dashboard/commandes";
  };

  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
    <ViewTransition enter="kv-content-in" default="none">
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-lg font-semibold text-encre">Commandes</h1>
        {subscription.features.canExportStats ? (
          // eslint-disable-next-line @next/next/no-html-link-for-pages -- route API (fichier à télécharger), pas une page Next : <Link> tenterait une navigation client au lieu d'un téléchargement
          <a
            href="/api/dashboard/commandes/export"
            className="rounded-md border border-ligne px-3 py-1.5 text-sm font-medium text-encre hover:bg-brume"
          >
            Exporter en CSV
          </a>
        ) : (
          <span
            title="Export disponible à partir du plan Pro"
            className="cursor-not-allowed rounded-md border border-dashed border-ligne px-3 py-1.5 text-sm font-medium text-encre/40"
          >
            Exporter en CSV (Pro)
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-ligne bg-white p-4">
          <p className="text-xs text-encre/60">Commandes du jour</p>
          <p className="mt-1 font-mono text-lg font-semibold text-encre">{todayCount}</p>
        </div>
        <div className="rounded-lg border border-ligne bg-white p-4">
          <p className="text-xs text-encre/60">En attente de traitement</p>
          <p className="mt-1 font-mono text-lg font-semibold text-encre">{pendingCount}</p>
        </div>
        <div className="rounded-lg border border-ligne bg-white p-4">
          <p className="text-xs text-encre/60">Livrées aujourd&apos;hui</p>
          <p className="mt-1 font-mono text-lg font-semibold text-encre">{deliveredTodayCount}</p>
        </div>
        <div className="rounded-lg border border-ligne bg-white p-4">
          <p className="text-xs text-encre/60">Taux de livraison</p>
          <p className="mt-1 font-mono text-lg font-semibold text-encre">
            {deliveryRate === null ? "—" : `${deliveryRate.toFixed(0)}%`}
          </p>
          <p className="mt-0.5 text-xs text-encre/50">Depuis toujours</p>
        </div>
      </div>

      {urgentOrders.length > 0 && (
        <div className="mt-4 rounded-lg border border-attention/30 bg-attention/5 p-4">
          <h2 className="font-display text-sm font-semibold text-attention">Commandes urgentes</h2>
          <ul className="mt-2 divide-y divide-attention/15">
            {urgentOrders.map((o) => (
              <li key={o.id} className="py-2">
                <Link
                  href={`/dashboard/commandes/${o.id}`}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 truncate text-encre">{o.customer_name}</span>
                  <span className="shrink-0 text-encre/60">
                    En attente depuis {Math.floor(hoursSince(o.created_at))}h
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5">
        {STATUS_TABS.map((tab) => {
          const isActive = tab.value === status;
          const count = tab.value ? statusCounts.get(tab.value) ?? 0 : totalOrdersEver;
          return (
            <Link
              key={tab.value || "toutes"}
              href={buildQuery({ statut: tab.value || undefined, page: undefined })}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                isActive
                  ? "border-vert-actif bg-vert-actif text-ivoire"
                  : "border-ligne text-encre/70 hover:border-vert-actif"
              }`}
            >
              {tab.label} <span className={isActive ? "opacity-80" : "text-encre/45"}>{count}</span>
            </Link>
          );
        })}
      </div>

      <form method="GET" className="mt-3 flex flex-wrap items-end gap-2">
        {status && <input type="hidden" name="statut" value={status} />}
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Rechercher un client (nom ou téléphone)..."
          className="w-full max-w-sm rounded-md border border-ligne px-3 py-2 text-sm focus:ring-2 focus:ring-vert-actif"
        />
        <label className="flex flex-col gap-1 text-xs text-encre/60">
          Du
          <input
            type="date"
            name="du"
            defaultValue={du ?? ""}
            className="rounded-md border border-ligne px-3 py-1.5 text-sm focus:ring-2 focus:ring-vert-actif"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-encre/60">
          Au
          <input
            type="date"
            name="au"
            defaultValue={au ?? ""}
            className="rounded-md border border-ligne px-3 py-1.5 text-sm focus:ring-2 focus:ring-vert-actif"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-vert-actif px-4 py-2 text-sm font-medium text-ivoire hover:bg-vert-sapin"
        >
          Filtrer
        </button>
      </form>

      {(orders ?? []).length === 0 ? (
        <p className="mt-4 text-sm text-encre/70">
          {trimmedQuery || status || du || au
            ? "Aucune commande ne correspond à ces filtres."
            : "Aucune commande pour l'instant. Elles apparaîtront ici dès qu'un client commandera sur ta boutique."}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-ligne">
          {(orders as Order[]).map((order) => {
            const items = itemsByOrder.get(order.id) ?? [];
            const first = items[0];
            const thumbnail = first ? firstThumbnail(first.product?.product_images) : undefined;
            const productLabel = first?.product?.title ?? "Produit supprimé";
            const extraCount = items.length - 1;

            return (
              <li key={order.id} className="py-3">
                <Link
                  href={`/dashboard/commandes/${order.id}`}
                  transitionTypes={["nav-forward"]}
                  className="flex items-center gap-3"
                >
                  <ProductImage src={thumbnail} alt={productLabel} className="h-11 w-11 shrink-0 rounded-md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-encre">
                      {order.customer_name}
                      <span
                        className={`ml-2 rounded px-1.5 py-0.5 text-xs ${
                          ORDER_STATUS_BADGE_CLASS[order.status] ?? "bg-brume text-encre/70"
                        }`}
                      >
                        {ORDER_STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </p>
                    <p className="truncate text-xs text-encre/60">
                      {productLabel}
                      {extraCount > 0 && <span className="text-encre/45"> + {extraCount} autre(s)</span>}
                    </p>
                    <p className="text-sm text-encre/70">
                      <span className="font-mono text-vert-actif">
                        {FMT_FCFA.format(order.total_amount)} FCFA
                      </span>{" "}
                      — {new Date(order.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm">
          {page > 1 ? (
            <Link
              href={buildQuery({ page: String(page - 1) })}
              className="rounded-md border border-ligne px-3 py-1.5 text-encre transition hover:border-vert-actif"
            >
              ‹ Précédent
            </Link>
          ) : (
            <span className="rounded-md border border-ligne px-3 py-1.5 text-encre/30">‹ Précédent</span>
          )}
          <span className="px-2 font-mono text-encre/70">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={buildQuery({ page: String(page + 1) })}
              className="rounded-md border border-ligne px-3 py-1.5 text-encre transition hover:border-vert-actif"
            >
              Suivant ›
            </Link>
          ) : (
            <span className="rounded-md border border-ligne px-3 py-1.5 text-encre/30">Suivant ›</span>
          )}
        </div>
      )}
    </div>
    </ViewTransition>
    </ViewTransition>
  );
}
