import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ORDER_STATUS_LABELS, ORDER_STATUS_BADGE_CLASS } from "@/lib/orders";
import { PackageIcon, SearchIcon } from "@/components/admin/admin-icons";

const PAGE_SIZE = 50;

const ORDER_SELECT = "id, customer_name, customer_phone, status, payment_method, total_amount, created_at, shop:shops(name, slug)";

type OrderRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  payment_method: string;
  total_amount: number;
  created_at: string;
  shop: { name: string; slug: string } | { name: string; slug: string }[] | null;
};

// Même échappement ILIKE que /admin/vendeurs (%, _) — cohérence avec la
// leçon du 22/09/2026 sur ce point.
function escapeIlike(value: string): string {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}

/**
 * Vue commandes plateforme — trou signalé dans l'audit back-office : jusqu'ici
 * aucune page n'exploitait la policy `orders_admin_read` (0007), la seule
 * visibilité sur les commandes étant le dashboard de chaque vendeur
 * individuellement. Utile pour retrouver la commande d'un client qui se
 * plaint sans avoir à demander au vendeur, ou repérer un volume anormal.
 *
 * Recherche volontairement limitée à nom/téléphone client (colonnes directes
 * de `orders`, deux requêtes `.ilike()` parallèles fusionnées par id — même
 * méthode que /admin/vendeurs, jamais de `.or()` construit à la main, voir
 * decisions-techniques.md du 22/09/2026 sur ce piège) : pas de recherche par
 * nom de boutique pour l'instant (filtrer sur une relation imbriquée
 * complique la pagination par comptage exact) — si le besoin se confirme,
 * on ajoutera un vrai sélecteur de boutique plutôt qu'une recherche texte
 * approximative sur un JOIN.
 */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { q, status: statusParam, page: pageParam } = await searchParams;
  const trimmedQuery = q?.trim() || undefined;
  const status = statusParam && statusParam in ORDER_STATUS_LABELS ? statusParam : undefined;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  let orders: OrderRow[] | null = null;
  let ordersCount: number | null = null;
  let fetchError: string | null = null;

  if (trimmedQuery) {
    const escaped = escapeIlike(trimmedQuery);
    const byName = supabase
      .from("orders")
      .select(ORDER_SELECT, { count: "exact" })
      .ilike("customer_name", `%${escaped}%`)
      .order("created_at", { ascending: false })
      .range(from, to);
    const byPhone = supabase
      .from("orders")
      .select(ORDER_SELECT, { count: "exact" })
      .ilike("customer_phone", `%${escaped}%`)
      .order("created_at", { ascending: false })
      .range(from, to);

    const [nameResult, phoneResult] = await Promise.all([
      status ? byName.eq("status", status) : byName,
      status ? byPhone.eq("status", status) : byPhone,
    ]);

    if (nameResult.error || phoneResult.error) {
      fetchError = nameResult.error?.message ?? phoneResult.error?.message ?? "Erreur inconnue";
    } else {
      const merged = new Map<string, OrderRow>();
      for (const row of [...(nameResult.data ?? []), ...(phoneResult.data ?? [])] as OrderRow[]) {
        merged.set(row.id, row);
      }
      orders = [...merged.values()].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      // Approximation, même choix assumé que /admin/vendeurs : une vraie borne
      // exigerait une requête UNION dédiée côté base.
      ordersCount = Math.max(nameResult.count ?? 0, phoneResult.count ?? 0);
    }
  } else {
    let query = supabase
      .from("orders")
      .select(ORDER_SELECT, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (status) query = query.eq("status", status);

    const { data, count, error } = await query;
    orders = data as OrderRow[] | null;
    ordersCount = count;
    fetchError = error?.message ?? null;
  }

  const totalPages = ordersCount ? Math.ceil(ordersCount / PAGE_SIZE) : 1;

  const baseParams = { ...(trimmedQuery ? { q: trimmedQuery } : {}), ...(status ? { status } : {}) };

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Commandes</h1>
      <p className="mt-1 text-sm text-encre/70">
        Toutes les commandes de la plateforme, tous vendeurs confondus.
      </p>

      <form method="GET" className="mt-4 flex flex-wrap gap-2">
        <div className="relative w-full max-w-sm">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-encre/40" />
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Nom ou téléphone du client..."
            className="w-full rounded-md border border-ligne py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-vert-actif"
          />
        </div>
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-md border border-ligne px-3 py-2 text-sm focus:ring-2 focus:ring-vert-actif"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-vert-actif px-4 py-2 text-sm font-medium text-ivoire hover:bg-vert-sapin"
        >
          Rechercher
        </button>
      </form>

      {fetchError && (
        <p className="mt-4 rounded-md border border-erreur/30 bg-erreur/5 px-3 py-2 text-sm text-erreur">
          Impossible de charger les commandes pour l&apos;instant. Réessaie dans un instant.
        </p>
      )}

      {!fetchError && (orders ?? []).length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-lg border border-dashed border-ligne bg-white py-12 text-center">
          <PackageIcon className="h-8 w-8 text-encre/30" />
          <p className="text-sm text-encre/60">Aucune commande trouvée.</p>
        </div>
      ) : fetchError ? null : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-ligne bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-ligne text-xs text-encre/50">
                <th className="py-3 pl-4 pr-4">Client</th>
                <th className="py-3 pr-4">Boutique</th>
                <th className="py-3 pr-4">Paiement</th>
                <th className="py-3 pr-4">Montant</th>
                <th className="py-3 pr-4">Statut</th>
                <th className="py-3 pr-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ligne">
              {(orders as OrderRow[]).map((order) => {
                const shop = Array.isArray(order.shop) ? order.shop[0] : order.shop;
                return (
                  <tr key={order.id} className="transition-colors hover:bg-brume/60">
                    <td className="py-3 pl-4 pr-4">
                      <p className="font-medium text-encre">{order.customer_name}</p>
                      <p className="text-xs text-encre/50">{order.customer_phone}</p>
                    </td>
                    <td className="py-3 pr-4 text-encre/70">
                      {shop ? (
                        <Link href={`/admin/vendeurs/${shop.slug}`} className="underline hover:text-vert-actif">
                          {shop.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 pr-4 text-encre/60">
                      {order.payment_method === "cash_on_delivery" ? "À la livraison" : "Mobile Money"}
                    </td>
                    <td className="py-3 pr-4 font-mono text-encre/70">{order.total_amount} FCFA</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${ORDER_STATUS_BADGE_CLASS[order.status] ?? "bg-sable text-encre/60"}`}
                      >
                        {ORDER_STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-encre/50">
                      {new Date(order.created_at).toLocaleString("fr-FR")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!fetchError && totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm">
          {page > 1 ? (
            <Link
              href={`/admin/commandes?${new URLSearchParams({ ...baseParams, page: String(page - 1) })}`}
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
              href={`/admin/commandes?${new URLSearchParams({ ...baseParams, page: String(page + 1) })}`}
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
  );
}
