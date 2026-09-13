import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ReviewForm } from "./review-form";

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
              product_id: string;
              product_title: string;
              variant_label: string | null;
              quantity: number;
              unit_price: number;
            },
            index: number
          ) => (
            <li key={index} className="flex justify-between py-2">
              <span>
                {item.product_title}
                {item.variant_label ? ` (${item.variant_label})` : ""}
                {" × "}
                {item.quantity}
              </span>
              <span>{item.unit_price * item.quantity} FCFA</span>
            </li>
          )
        )}
      </ul>

      <dl className="mt-4 divide-y divide-gray-100 text-sm">
        <div className="flex justify-between py-1 text-gray-600">
          <dt>Sous-total produits</dt>
          <dd>{order.total_amount - order.delivery_fee} FCFA</dd>
        </div>
        <div className="flex justify-between py-1 text-gray-600">
          <dt>Frais de livraison</dt>
          <dd>{order.delivery_fee} FCFA</dd>
        </div>
        <div className="flex justify-between py-1 text-base font-medium text-gray-900">
          <dt>Total</dt>
          <dd>{order.total_amount} FCFA</dd>
        </div>
      </dl>

      {(items ?? []).length > 0 && (
        <section className="mt-8 border-t border-gray-200 pt-4">
          <h2 className="text-sm font-medium text-gray-700">Laisser un avis</h2>
          <p className="mt-1 text-xs text-gray-400">
            Pas encore reçu ta commande ? Pas de souci, tu peux garder cette
            page (ou son lien) et revenir laisser ton avis plus tard.
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {Array.from(
              new Map(
                (
                  items as { product_id: string; product_title: string }[]
                ).map((item) => [item.product_id, item])
              ).values()
            ).map((item) => (
              <ReviewForm
                key={item.product_id}
                orderId={order.id}
                productId={item.product_id}
                productTitle={item.product_title}
              />
            ))}
          </div>
        </section>
      )}

      <Link href={`/${shopSlug}`} className="mt-6 inline-block text-sm underline">
        Retour à la boutique
      </Link>
    </main>
  );
}
