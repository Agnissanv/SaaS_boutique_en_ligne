import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddToCartForm } from "./add-to-cart-form";
import { ProductGallery } from "./product-gallery";
import { WhatsappShareButton } from "./whatsapp-share-button";

const LOW_STOCK_THRESHOLD = 5;

type Review = {
  customer_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

function Stars({ rating }: { rating: number }) {
  const rounded = Math.round(rating);
  return (
    <span aria-hidden="true">
      {"★".repeat(rounded)}
      {"☆".repeat(5 - rounded)}
    </span>
  );
}

/** Note moyenne + liste des avis (cf. migration 0011, submit_product_review). */
function ReviewsSection({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) {
    return (
      <p className="mt-2 text-sm text-gray-500">
        Aucun avis pour ce produit pour l&apos;instant.
      </p>
    );
  }

  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  return (
    <div className="mt-2">
      <p className="text-sm font-medium text-gray-900">
        <Stars rating={average} /> {average.toFixed(1)}/5 ({reviews.length} avis)
      </p>
      <ul className="mt-3 flex flex-col gap-3">
        {reviews.map((review, index) => (
          <li key={index} className="border-t border-gray-100 pt-3 text-sm">
            <p className="font-medium text-gray-900">
              <Stars rating={review.rating} /> — {review.customer_name}
            </p>
            {review.comment && <p className="mt-1 text-gray-600">{review.comment}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

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

  const { data: reviews } = await supabase
    .from("product_reviews")
    .select("customer_name, rating, comment, created_at")
    .eq("product_id", product.id)
    .order("created_at", { ascending: false });

  const images = [...(product.product_images ?? [])].sort((a, b) => a.position - b.position);
  const tags: string[] = product.tags ?? [];
  const hasDiscount =
    product.compare_at_price != null && product.compare_at_price > product.price;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <ProductGallery images={images} title={product.title} />

      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <h1 className="mt-3 text-xl font-semibold text-gray-900">{product.title}</h1>
      <p className="mt-2 text-gray-600">{product.description}</p>

      <div className="mt-4 flex items-baseline gap-2">
        <p className="text-lg font-medium text-gray-900">{product.price} FCFA</p>
        {hasDiscount && (
          <p className="text-sm text-gray-400 line-through">
            {product.compare_at_price} FCFA
          </p>
        )}
      </div>

      {product.stock <= 0 ? (
        <p className="mt-1 text-sm font-medium text-red-600">Rupture de stock</p>
      ) : product.stock <= LOW_STOCK_THRESHOLD ? (
        <p className="mt-1 text-sm font-medium text-orange-600">
          Plus que {product.stock} en stock
        </p>
      ) : null}

      <div className="mt-3">
        <WhatsappShareButton title={product.title} />
      </div>

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

      <section className="mt-8 border-t border-gray-200 pt-4">
        <h2 className="text-sm font-medium text-gray-700">Avis clients</h2>
        <ReviewsSection reviews={reviews ?? []} />
      </section>
    </main>
  );
}
