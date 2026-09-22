import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { categoryLabel } from "@/lib/categories";
import { getShopSubscription, SUBSCRIPTION_STATE_LABELS, SUBSCRIPTION_STATE_BADGE_CLASS } from "@/lib/subscription";
import { ORDER_STATUS_LABELS, ORDER_STATUS_BADGE_CLASS } from "@/lib/orders";
import { StorefrontIcon } from "@/components/admin/admin-icons";
import { VendorRowActions } from "../vendor-row-actions";

type RecentOrder = {
  id: string;
  customer_name: string;
  status: string;
  total_amount: number;
  created_at: string;
};

/**
 * Fiche détaillée d'un vendeur — trou signalé dans l'audit back-office :
 * `/admin/vendeurs` n'offrait jusqu'ici qu'une ligne de tableau par boutique,
 * sans moyen de voir en un seul endroit son historique de commandes, son
 * volume, et son abonnement réel. Adressée par `slug` (comme les pages
 * boutique publiques) plutôt que par id — plus lisible dans l'URL, et le
 * slug est déjà unique.
 *
 * Réutilise `VendorRowActions` telle quelle (suspendre/réactiver + note
 * admin) plutôt que de dupliquer cette logique pour cette page — même
 * composant que la ligne de tableau de /admin/vendeurs.
 */
export default async function AdminVendorDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: shop } = await supabase
    .from("shops")
    .select(
      "id, name, slug, description, category, logo_url, status, created_at, owner:profiles(display_name, phone), shop_admin_notes(note)"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!shop) {
    notFound();
  }

  const owner = Array.isArray(shop.owner) ? shop.owner[0] : shop.owner;
  const notesRow = Array.isArray(shop.shop_admin_notes) ? shop.shop_admin_notes[0] : shop.shop_admin_notes;

  const [subscription, productsCountResult, ordersStatsResult, recentOrdersResult] = await Promise.all([
    getShopSubscription(supabase, shop.id),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shop.id)
      .is("deleted_at", null),
    supabase
      .from("orders")
      .select("total_amount", { count: "exact" })
      .eq("shop_id", shop.id)
      .neq("status", "cancelled"),
    supabase
      .from("orders")
      .select("id, customer_name, status, total_amount, created_at")
      .eq("shop_id", shop.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const productsCount = productsCountResult.count ?? 0;
  const ordersCount = ordersStatsResult.count ?? 0;
  // Sommé en JS plutôt qu'en base : le nombre de commandes d'UNE boutique
  // reste largement dans une plage raisonnable à rapatrier (contrairement au
  // CA plateforme entier, voir get_platform_revenue) — pas besoin d'une RPC
  // dédiée pour ce cas précis.
  const totalRevenue = (ordersStatsResult.data ?? []).reduce(
    (sum, o) => sum + Number(o.total_amount ?? 0),
    0
  );
  const recentOrders = (recentOrdersResult.data ?? []) as RecentOrder[];

  return (
    <div>
      <Link href="/admin/vendeurs" className="text-sm text-encre/60 underline hover:text-encre">
        ‹ Retour aux vendeurs
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {shop.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- image uploadée par le vendeur, source dynamique
            <img src={shop.logo_url} alt={shop.name} className="h-14 w-14 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brume text-lg font-semibold text-vert-actif">
              {shop.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="font-display text-lg font-semibold text-encre">{shop.name}</h1>
            <p className="text-sm text-encre/50">
              /{shop.slug} — {categoryLabel(shop.category)}
            </p>
            <p className="text-xs text-encre/50">
              Créée le {new Date(shop.created_at).toLocaleDateString("fr-FR")}
            </p>
          </div>
        </div>
        <VendorRowActions shopId={shop.id} status={shop.status} adminNotes={notesRow?.note ?? null} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-ligne bg-white p-4">
          <p className="text-xs text-encre/60">Produits actifs</p>
          <p className="mt-0.5 font-display text-lg font-semibold text-encre">{productsCount}</p>
        </div>
        <div className="rounded-lg border border-ligne bg-white p-4">
          <p className="text-xs text-encre/60">Commandes (hors annulées)</p>
          <p className="mt-0.5 font-display text-lg font-semibold text-encre">{ordersCount}</p>
        </div>
        <div className="rounded-lg border border-ligne bg-white p-4 sm:col-span-2">
          <p className="text-xs text-encre/60">Chiffre d&apos;affaires (hors annulées)</p>
          <p className="mt-0.5 font-mono text-lg font-semibold text-encre">{totalRevenue} FCFA</p>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-ligne bg-white p-4">
        <h2 className="text-sm font-medium text-encre">Vendeur</h2>
        <p className="mt-1 text-sm text-encre/70">{owner?.display_name ?? "—"}</p>
        <p className="text-sm text-encre/50">{owner?.phone ?? "—"}</p>

        <h2 className="mt-4 text-sm font-medium text-encre">Abonnement</h2>
        <p className="mt-1 flex items-center gap-2 text-sm text-encre/70">
          {subscription.planName ?? "Aucun plan"}
          <span
            className={`rounded px-1.5 py-0.5 text-xs ${SUBSCRIPTION_STATE_BADGE_CLASS[subscription.state]}`}
          >
            {SUBSCRIPTION_STATE_LABELS[subscription.state]}
          </span>
        </p>
        {subscription.expiresAt && (
          <p className="text-xs text-encre/50">
            Expire le {new Date(subscription.expiresAt).toLocaleDateString("fr-FR")}
          </p>
        )}
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-medium text-encre">Commandes récentes</h2>
        {recentOrders.length === 0 ? (
          <div className="mt-3 flex flex-col items-center gap-2 rounded-lg border border-dashed border-ligne bg-white py-10 text-center">
            <StorefrontIcon className="h-6 w-6 text-encre/30" />
            <p className="text-sm text-encre/60">Aucune commande pour cette boutique.</p>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-ligne bg-white">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-ligne text-xs text-encre/50">
                  <th className="py-3 pl-4 pr-4">Client</th>
                  <th className="py-3 pr-4">Montant</th>
                  <th className="py-3 pr-4">Statut</th>
                  <th className="py-3 pr-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ligne">
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="py-3 pl-4 pr-4 text-encre">{order.customer_name}</td>
                    <td className="py-3 pr-4 font-mono text-encre/70">{order.total_amount} FCFA</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${ORDER_STATUS_BADGE_CLASS[order.status] ?? "bg-sable text-encre/60"}`}
                      >
                        {ORDER_STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-encre/50">
                      {new Date(order.created_at).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
