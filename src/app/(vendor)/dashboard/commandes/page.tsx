import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ORDER_STATUS_LABELS, ORDER_STATUS_BADGE_CLASS } from "@/lib/orders";

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
      <div className="flex items-center justify-between">
        <h1 className="font-display text-lg font-semibold text-encre">Commandes</h1>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- route API (fichier à télécharger), pas une page Next : <Link> tenterait une navigation client au lieu d'un téléchargement */}
        <a
          href="/api/dashboard/commandes/export"
          className="rounded-md border border-ligne px-3 py-1.5 text-sm font-medium text-encre hover:bg-brume"
        >
          Exporter en CSV
        </a>
      </div>

      {(orders ?? []).length === 0 ? (
        <p className="mt-4 text-sm text-encre/70">
          Aucune commande pour l&apos;instant. Elles apparaîtront ici dès
          qu&apos;un client commandera sur ta boutique.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-ligne">
          {(orders as Order[]).map((order) => (
            <li key={order.id} className="py-3">
              <Link
                href={`/dashboard/commandes/${order.id}`}
                className="flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-encre">
                    {order.customer_name}
                    <span
                      className={`ml-2 rounded px-1.5 py-0.5 text-xs ${
                        ORDER_STATUS_BADGE_CLASS[order.status] ?? "bg-sable text-encre/70"
                      }`}
                    >
                      {ORDER_STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </p>
                  <p className="text-sm text-encre/70">
                    <span className="font-mono text-cuivre-profond">
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
    </div>
  );
}
