import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CartCheckout } from "./cart-checkout";

// Titre d'onglet « Panier — Nom de la boutique » (audit visuel du
// 13/10/2026), page jamais indexée.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ shopSlug: string }>;
}): Promise<Metadata> {
  const { shopSlug } = await params;
  const supabase = await createClient();
  const { data: shop } = await supabase
    .from("shops")
    .select("name")
    .eq("slug", shopSlug)
    .eq("status", "active")
    .maybeSingle();
  return {
    title: shop ? `Panier — ${shop.name} | KEVA` : "Page introuvable — KEVA",
    robots: { index: false, follow: false },
  };
}

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
    <main className="w-full mx-auto max-w-xl px-4 py-10">
      <h1 className="font-display text-xl font-semibold text-encre">
        Panier — {shop.name}
      </h1>
      <CartCheckout shopId={shop.id} shopSlug={shop.slug} deliveryFee={shop.delivery_fee} />
    </main>
  );
}
