import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CartCheckout } from "./cart-checkout";

// Recolorée en charte KEVA le 15/09/2026 (côté client) — pure recolor.
export default async function PanierPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>;
}) {
  const { shopSlug } = await params;
  const supabase = await createClient();

  const { data: shop } = await supabase
    .from("shops")
    .select("id, name, slug, delivery_fee")
    .eq("slug", shopSlug)
    .eq("status", "active")
    .maybeSingle();

  if (!shop) notFound();

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="font-display text-xl font-semibold text-encre">
        Panier — {shop.name}
      </h1>
      <CartCheckout shopId={shop.id} shopSlug={shop.slug} deliveryFee={shop.delivery_fee} />
    </main>
  );
}
