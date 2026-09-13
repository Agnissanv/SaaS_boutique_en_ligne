import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddToCartForm } from "./add-to-cart-form";

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
    .select(
      "*, shop:shops!inner(slug, status), product_images(url, position), product_variants(id, name, value, extra_price)"
    )
    .eq("slug", productSlug)
    .eq("shop.slug", shopSlug)
    .eq("shop.status", "active")
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (!product) notFound();

  const images = [...(product.product_images ?? [])].sort(
    (a: { position: number }, b: { position: number }) => a.position - b.position
  );

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      {images.length > 0 ? (
        <div className="mb-4 flex gap-2 overflow-x-auto">
          {images.map((img: { url: string }) => (
            // eslint-disable-next-line @next/next/no-img-element -- image uploadée par le vendeur, source dynamique
            <img
              key={img.url}
              src={img.url}
              alt={product.title}
              className="h-56 w-56 shrink-0 rounded object-cover"
            />
          ))}
        </div>
      ) : null}
      <h1 className="text-xl font-semibold text-gray-900">{product.title}</h1>
      <p className="mt-2 text-gray-600">{product.description}</p>
      <p className="mt-4 text-lg font-medium text-gray-900">
        {product.price} FCFA
      </p>

      <AddToCartForm
        shopSlug={shopSlug}
        productId={product.id}
        productSlug={product.slug}
        title={product.title}
        price={product.price}
        imageUrl={images[0]?.url}
        variants={product.product_variants ?? []}
        stock={product.stock}
      />
    </main>
  );
}
