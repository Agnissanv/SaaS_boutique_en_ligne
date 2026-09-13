import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusForm } from "./status-form";

const PAYMENT_LABELS: Record<string, string> = {
  cash_on_delivery: "Paiement à la livraison",
  mobile_money: "Mobile Money",
};

/** "+225 07 00 00 00 00" -> "22507000000" (format attendu par wa.me) */
function toWhatsappNumber(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
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

  const { data: order } = await supabase
    .from("orders")
    .select(
      "*, order_items(quantity, unit_price, products(title), order_item_variants(product_variants(name, value)))"
    )
    .eq("id", orderId)
    .eq("shop_id", shop.id)
    .maybeSingle();

  if (!order) notFound();

  const whatsappNumber = toWhatsappNumber(order.customer_phone);

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900">
        Commande de {order.customer_name}
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        {new Date(order.created_at).toLocaleString("fr-FR")} —{" "}
        {PAYMENT_LABELS[order.payment_method] ?? order.payment_method}
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <a
          href={`https://wa.me/${whatsappNumber}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white"
        >
          Contacter sur WhatsApp
        </a>
        <a
          href={`tel:${order.customer_phone}`}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700"
        >
          Appeler
        </a>
      </div>

      {order.delivery_address && (
        <p className="mt-4 text-sm text-gray-700">
          <span className="font-medium">Livraison :</span> {order.delivery_address}
        </p>
      )}
      {order.delivery_lat != null && order.delivery_lng != null && (
        <a
          href={`https://www.google.com/maps?q=${order.delivery_lat},${order.delivery_lng}`}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block text-sm text-blue-600 underline"
        >
          📍 Voir la position exacte sur Google Maps
        </a>
      )}

      <h2 className="mt-6 text-sm font-medium text-gray-700">Articles</h2>
      <ul className="mt-2 divide-y divide-gray-200 text-sm">
        {(
          order.order_items as {
            quantity: number;
            unit_price: number;
            products: { title: string } | null;
            order_item_variants: { product_variants: { name: string; value: string } | null }[];
          }[]
        ).map((item, index) => {
          const variantLabel = item.order_item_variants
            .map((v) => v.product_variants)
            .filter((v): v is { name: string; value: string } => Boolean(v))
            .map((v) => `${v.name}: ${v.value}`)
            .join(", ");

          return (
            <li key={index} className="flex justify-between py-2">
              <span>
                {item.products?.title}
                {variantLabel ? ` (${variantLabel})` : ""}
                {" × "}
                {item.quantity}
              </span>
              <span>{item.unit_price * item.quantity} FCFA</span>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-right text-lg font-medium text-gray-900">
        Total : {order.total_amount} FCFA
      </p>

      <StatusForm orderId={order.id} currentStatus={order.status} />
    </div>
  );
}
