import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  paid: "Payée",
  preparing: "En préparation",
  delivered: "Livrée",
  cancelled: "Annulée",
};

type Order = {
  id: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  total_amount: number;
  created_at: string;
};

// Liste des commandes (En attente, Payée, En préparation, Livrée, Annulée)
// + détail, changement de statut, contact WhatsApp client. cf. §3.1.A.5.
export default async function OrdersPage() {
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

  const { data: orders } = await supabase
    .from("orders")
    .select("id, customer_name, customer_phone, status, total_amount, created_at")
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900">Commandes</h1>

      {(orders ?? []).length === 0 ? (
        <p className="mt-4 text-sm text-gray-600">
          Aucune commande pour l&apos;instant. Elles apparaîtront ici dès
          qu&apos;un client commandera sur ta boutique.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-200">
          {(orders as Order[]).map((order) => (
            <li key={order.id} className="py-3">
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
                    {order.total_amount} FCFA —{" "}
                    {new Date(order.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
