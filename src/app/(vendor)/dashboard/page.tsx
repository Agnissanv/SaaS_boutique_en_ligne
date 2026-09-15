import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LOW_STOCK_THRESHOLD } from "@/lib/products";

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  paid: "Payée",
  preparing: "En préparation",
  delivered: "Livrée",
  cancelled: "Annulée",
};

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
};

/** Somme `total_amount` des commandes non annulées créées depuis `since`. */
async function sumRevenueSince(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shopId: string,
  since: Date
) {
  const { data } = await supabase
    .from("orders")
    .select("total_amount")
    .eq("shop_id", shopId)
    .neq("status", "cancelled")
    .gte("created_at", since.toISOString());

  return (data ?? []).reduce((sum, o) => sum + o.total_amount, 0);
}

// Aperçu vendeur : vues boutique, nombre de commandes, CA jour/semaine/mois,
// commandes récentes, alertes stock bas (cf. cahier des charges §3.1.A.4).
export default async function DashboardOverviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: shop } = await supabase
    .from("shops")
    .select("id, name, view_count")
    .eq("owner_id", user?.id ?? "")
    .maybeSingle();

  // Pas encore de boutique : on guide le vendeur vers la création avant de
  // lui montrer des statistiques vides.
  if (!shop) {
    redirect("/dashboard/boutique");
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  // Semaine calée sur lundi (convention FR/CI) plutôt que dimanche.
  startOfWeek.setDate(startOfDay.getDate() - ((startOfDay.getDay() + 6) % 7));
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    { count: ordersCount },
    revenueDay,
    revenueWeek,
    revenueMonth,
    { data: recentOrders },
    { data: lowStockProducts },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shop.id),
    sumRevenueSince(supabase, shop.id, startOfDay),
    sumRevenueSince(supabase, shop.id, startOfWeek),
    sumRevenueSince(supabase, shop.id, startOfMonth),
    supabase
      .from("orders")
      .select("id, customer_name, status, total_amount, created_at")
      .eq("shop_id", shop.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("products")
      .select("id, title, stock")
      .eq("shop_id", shop.id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .lte("stock", LOW_STOCK_THRESHOLD)
      .order("stock", { ascending: true }),
  ]);

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900">Aperçu</h1>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Vues de la boutique" value={shop.view_count ?? 0} />
        <StatTile label="Commandes" value={ordersCount ?? 0} />
        <StatTile label="CA aujourd'hui" value={`${revenueDay} FCFA`} />
        <StatTile label="CA ce mois" value={`${revenueMonth} FCFA`} />
      </div>
      <p className="mt-2 text-xs text-gray-500">
        CA cette semaine : {revenueWeek} FCFA. Chiffre d&apos;affaires calculé
        sur les commandes non annulées.
      </p>

      {(lowStockProducts ?? []).length > 0 && (
        <div className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-4">
          <h2 className="text-sm font-medium text-amber-900">
            Stock bas ({LOW_STOCK_THRESHOLD} unités ou moins)
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-amber-800">
            {(lowStockProducts as LowStockProduct[]).map((product) => (
              <li key={product.id} className="flex justify-between">
                <span>{product.title}</span>
                <span>{product.stock} en stock</span>
              </li>
            ))}
          </ul>
          <Link
            href="/dashboard/produits"
            className="mt-2 inline-block text-sm font-medium text-amber-900 underline"
          >
            Gérer les stocks
          </Link>
        </div>
      )}

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-700">
            Commandes récentes
          </h2>
          <Link href="/dashboard/commandes" className="text-sm text-gray-500 underline">
            Voir tout
          </Link>
        </div>

        {(recentOrders ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">
            Aucune commande pour l&apos;instant.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-200">
            {(recentOrders as RecentOrder[]).map((order) => (
              <li key={order.id} className="py-2">
                <Link
                  href={`/dashboard/commandes/${order.id}`}
                  className="flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {order.customer_name}
                      <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </p>
                    <p className="text-sm text-gray-600">
                      {new Date(order.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm text-gray-900">
                    {order.total_amount} FCFA
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-gray-200 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}
