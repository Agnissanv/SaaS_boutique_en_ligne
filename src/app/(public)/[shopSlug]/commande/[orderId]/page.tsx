import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ReviewForm } from "./review-form";
import { ORDER_STATUS_BADGE_CLASS, ORDER_STATUS_LABELS } from "@/lib/orders";

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
 *
 * Recolorée en charte KEVA le 15/09/2026 (côté client) — pure recolor. Le
 * dictionnaire de statuts local dupliqué a été retiré au profit du module
 * partagé `src/lib/orders.ts` (déjà utilisé par le dashboard vendeur et par
 * /compte) ; le statut s'affiche désormais en badge coloré.
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
    <main className="w-full mx-auto max-w-xl px-4 py-10">
      <h1 className="font-display text-xl font-semibold text-encre">Commande confirmée</h1>
      <p className="mt-2 text-sm text-encre/70">
        Merci {order.customer_name}, ta commande chez {order.shop_name} a bien
        été enregistrée.
      </p>

      <dl className="mt-6 divide-y divide-ligne text-sm">
        <div className="flex justify-between py-2">
          <dt className="text-encre/70">Statut</dt>
          <dd>
            <span
              className={`rounded px-1.5 py-0.5 text-xs ${
                ORDER_STATUS_BADGE_CLASS[order.status] ?? "bg-sable text-encre/60"
              }`}
            >
              {ORDER_STATUS_LABELS[order.status] ?? order.status}
            </span>
          </dd>
        </div>
        <div className="flex justify-between py-2">
          <dt className="text-encre/70">Paiement</dt>
          <dd className="font-medium text-encre">
            {PAYMENT_LABELS[order.payment_method] ?? order.payment_method}
          </dd>
        </div>
        {order.delivery_address && (
          <div className="flex justify-between py-2">
            <dt className="text-encre/70">Livraison</dt>
            <dd className="font-medium text-encre">{order.delivery_address}</dd>
          </div>
        )}
      </dl>

      {order.delivery_lat != null && order.delivery_lng != null && (
        <a
          href={`https://www.google.com/maps?q=${order.delivery_lat},${order.delivery_lng}`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-sm text-vert-actif underline"
        >
          📍 Ta position partagée
        </a>
      )}

      <h2 className="mt-6 text-sm font-medium text-encre">Détail</h2>
      <ul className="mt-2 divide-y divide-ligne text-sm">
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
            <li key={index} className="flex justify-between py-2 text-encre">
              <span>
                {item.product_title}
                {item.variant_label ? ` (${item.variant_label})` : ""}
                {" × "}
                {item.quantity}
              </span>
              <span className="font-mono text-cuivre-profond">
                {item.unit_price * item.quantity} FCFA
              </span>
            </li>
          )
        )}
      </ul>

      <dl className="mt-4 divide-y divide-ligne text-sm">
        <div className="flex justify-between py-1 text-encre/70">
          <dt>Sous-total produits</dt>
          <dd className="font-mono text-cuivre-profond">
            {order.total_amount - order.delivery_fee} FCFA
          </dd>
        </div>
        <div className="flex justify-between py-1 text-encre/70">
          <dt>Frais de livraison</dt>
          <dd className="font-mono text-cuivre-profond">{order.delivery_fee} FCFA</dd>
        </div>
        <div className="flex justify-between py-1 text-base font-medium text-encre">
          <dt>Total</dt>
          <dd className="font-mono text-cuivre-profond">{order.total_amount} FCFA</dd>
        </div>
      </dl>

      {(items ?? []).length > 0 && (
        <section className="mt-8 border-t border-ligne pt-4">
          <h2 className="text-sm font-medium text-encre">Laisser un avis</h2>
          <p className="mt-1 text-xs text-encre/40">
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

      <Link href={`/${shopSlug}`} className="mt-6 inline-block text-sm text-vert-actif underline">
        Retour à la boutique
      </Link>
    </main>
  );
}
