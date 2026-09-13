import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  paid: "Payée",
  preparing: "En préparation",
  delivered: "Livrée",
  cancelled: "Annulée",
};

const PAYMENT_LABELS: Record<string, string> = {
  cash_on_delivery: "Paiement à la livraison",
  mobile_money: "Mobile Money",
};

/**
 * Confirmation de commande + reçu (cahier des charges §3.1.B.6).
 * Route : /[shopSlug]/commande/[orderId]
 *
 * Accessible sans compte via l'id (UUID non devinable) de la commande, tout
 * juste créée par create_order — voir 0004_orders_rpc.sql pour le choix
 * d'exposer ça via des fonctions RPC plutôt qu'une policy RLS large.
 */
export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ shopSlug: string; orderId: string }>;
}) {
  const { shopSlug, orderId } = await params;
  const supabase = await createClient();

  const { data: orders } = await supabase.rpc("get_order_receipt", {
    p_order_id: orderId,
  });
  const order = orders?.[0];

  if (!order || order.shop_slug !== shopSlug) notFound();

  const { data: items } = await supabase.rpc("get_order_receipt_items", {
    p_order_id: orderId,
  });

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-xl font-semibold text-gray-900">Commande confirmée</h1>
      <p className="mt-2 text-sm text-gray-600">
        Merci {order.customer_name}, ta commande chez {order.shop_name} a bien
        été enregistrée.
      </p>

      <dl className="mt-6 divide-y divide-gray-200 text-sm">
        <div className="flex justify-between py-2">
          <dt className="text-gray-600">Statut</dt>
          <dd className="font-medium text-gray-900">
            {STATUS_LABELS[order.status] ?? order.status}
          </dd>
        </div>
        <div className="flex justify-between py-2">
          <dt className="text-gray-600">Paiement</dt>
          <dd className="font-medium text-gray-900">
            {PAYMENT_LABELS[order.payment_method] ?? order.payment_method}
          </dd>
        </div>
        {order.delivery_address && (
          <div className="flex justify-between py-2">
            <dt className="text-gray-600">Livraison</dt>
            <dd className="font-medium text-gray-900">{order.delivery_address}</dd>
          </div>
        )}
      </dl>

      {order.delivery_lat != null && order.delivery_lng != null && (
        <a
          href={`https://www.google.com/maps?q=${order.delivery_lat},${order.delivery_lng}`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-sm text-blue-600 underline"
        >
          📍 Ta position partagée
        </a>
      )}

      <h2 className="mt-6 text-sm font-medium text-gray-700">Détail</h2>
      <ul className="mt-2 divide-y divide-gray-200 text-sm">
        {(items ?? []).map(
          (
            item: {
              product_title: string;
              variant_name: string | null;
              variant_value: string | null;
              quantity: number;
              unit_price: number;
            },
            index: number
          ) => (
            <li key={index} className="flex justify-between py-2">
              <span>
                {item.product_title}
                {item.variant_name ? ` (${item.variant_name} : ${item.variant_value})` : ""}
                {" × "}
                {item.quantity}
              </span>
              <span>{item.unit_price * item.quantity} FCFA</span>
            </li>
          )
        )}
      </ul>

      <p className="mt-4 text-right text-lg font-medium text-gray-900">
        Total : {order.total_amount} FCFA
      </p>

      <Link href={`/${shopSlug}`} className="mt-6 inline-block text-sm underline">
        Retour à la boutique
      </Link>
    </main>
  );
}
