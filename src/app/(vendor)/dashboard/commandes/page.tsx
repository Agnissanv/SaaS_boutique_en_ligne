import Link from "next/link";
import { ViewTransition } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getShopSubscription } from "@/lib/subscription";
import { getAccessibleShop } from "@/lib/shop-access";
import { ORDER_STATUS_LABELS, ORDER_STATUS_BADGE_CLASS } from "@/lib/orders";

const PAGE_SIZE = 50;

type Order = {
  id: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  total_amount: number;
  created_at: string;
};

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "", label: "Toutes" },
  ...Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

// Échappe les caractères spéciaux ILIKE (% et _) — même helper que côté admin
// (src/app/(admin)/admin/vendeurs/page.tsx).
function escapeIlike(value: string): string {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}

/**
 * Liste des commandes (En attente, Payée, En préparation, Livrée, Annulée)
 * + détail, changement de statut, contact WhatsApp client. cf. §3.1.A.5.
 *
 * **Recherche + filtre + pagination ajoutés le 22/09/2026** — demande
 * d'Isaac ("je veux des filtres partout... si on a 1000 ou 2000 boutiques")
 * : cette page chargeait jusqu'ici TOUTES les commandes de la boutique sans
 * aucune limite, alors qu'une boutique active peut facilement en accumuler
 * des centaines. Même pattern que `/admin/commandes` (recherche nom/téléphone
 * via deux `.ilike()` fusionnés plutôt qu'un `.or()` — même faille de
 * virgule/parenthèse déjà corrigée deux fois côté admin), pagination 50/page.
 */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string; page?: string }>;
}) {
  const { q, statut: statusParam, page: pageParam } = await searchParams;
  const trimmedQuery = q?.trim() || undefined;
  const status = statusParam && statusParam in ORDER_STATUS_LABELS ? statusParam : "";
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

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
  // Lancée en parallèle des requêtes commandes ci-dessous (aucune dépendance
  // entre les deux), comme avant l'ajout de la recherche/pagination.
  const subscriptionPromise = getShopSubscription(supabase, access.shopId);

  let orders: Order[] | null = null;
  let ordersCount: number | null = null;

  if (trimmedQuery) {
    const escaped = escapeIlike(trimmedQuery);
    let byName = supabase
      .from("orders")
      .select(ORDER_SELECT, { count: "exact" })
      .eq("shop_id", access.shopId)
      .ilike("customer_name", `%${escaped}%`);
    let byPhone = supabase
      .from("orders")
      .select(ORDER_SELECT, { count: "exact" })
      .eq("shop_id", access.shopId)
      .ilike("customer_phone", `%${escaped}%`);
    if (status) {
      byName = byName.eq("status", status);
      byPhone = byPhone.eq("status", status);
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
      .eq("shop_id", access.shopId);
    if (status) query = query.eq("status", status);
    const { data, count } = await query.order("created_at", { ascending: false }).range(from, to);
    orders = data as Order[] | null;
    ordersCount = count;
  }

  const totalPages = ordersCount ? Math.ceil(ordersCount / PAGE_SIZE) : 1;
  const subscription = await subscriptionPromise;

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

      <form method="GET" className="mt-4 flex flex-wrap gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Rechercher un client (nom ou téléphone)..."
          className="w-full max-w-sm rounded-md border border-ligne px-3 py-2 text-sm focus:ring-2 focus:ring-vert-actif"
        />
        <select
          name="statut"
          defaultValue={status}
          className="rounded-md border border-ligne px-3 py-2 text-sm focus:ring-2 focus:ring-vert-actif"
        >
          {STATUS_TABS.map((tab) => (
            <option key={tab.value} value={tab.value}>
              {tab.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-vert-actif px-4 py-2 text-sm font-medium text-ivoire hover:bg-vert-sapin"
        >
          Filtrer
        </button>
      </form>

      {(orders ?? []).length === 0 ? (
        <p className="mt-4 text-sm text-encre/70">
          {trimmedQuery || status
            ? "Aucune commande ne correspond à ces filtres."
            : "Aucune commande pour l'instant. Elles apparaîtront ici dès qu'un client commandera sur ta boutique."}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-ligne">
          {(orders as Order[]).map((order) => (
            <li key={order.id} className="py-3">
              <Link
                href={`/dashboard/commandes/${order.id}`}
                transitionTypes={["nav-forward"]}
                className="flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
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
                  <p className="text-sm text-encre/70">
                    <span className="font-mono text-vert-actif">
                      {order.total_amount} FCFA
                    </span>{" "}
                    — {new Date(order.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm">
          {page > 1 ? (
            <Link
              href={`/dashboard/commandes?${new URLSearchParams({ ...(trimmedQuery ? { q: trimmedQuery } : {}), ...(status ? { statut: status } : {}), page: String(page - 1) })}`}
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
              href={`/dashboard/commandes?${new URLSearchParams({ ...(trimmedQuery ? { q: trimmedQuery } : {}), ...(status ? { statut: status } : {}), page: String(page + 1) })}`}
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
