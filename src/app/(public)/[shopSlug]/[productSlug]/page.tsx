import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Page détail produit.
 * Route : /[shopSlug]/[productSlug]
 */
export default async function ProductPage({
  params,
}: {
  params: Promise<{ shopSlug: string; productSlug: string }>;
}) {
  const { shopSlug, productSlug } = await params;
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("*, shop:shops!inner(slug, status)")
    .eq("slug", productSlug)
    .eq("shop.slug", shopSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (!product) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-semibold text-gray-900">{product.title}</h1>
      <p className="mt-2 text-gray-600">{product.description}</p>
      <p className="mt-4 text-lg font-medium text-gray-900">
        {product.price} FCFA
      </p>
      {/* TODO: sélection de variante, ajout au panier, tunnel de commande */}
    </main>
  );
}
