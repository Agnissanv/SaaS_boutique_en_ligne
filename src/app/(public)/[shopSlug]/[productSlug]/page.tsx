import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddToCartForm } from "./add-to-cart-form";
import { ProductGallery } from "./product-gallery";
import { WhatsappShareButton } from "./whatsapp-share-button";
import { Stars } from "@/components/stars";
import { WishlistButton } from "@/components/wishlist-button";
import { getShopRating } from "@/lib/reviews";
import { WhatsappContactButton } from "@/components/whatsapp-contact-button";

const LOW_STOCK_THRESHOLD = 5;
const RELATED_LIMIT = 4;

type Review = {
  customer_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

type RelatedProduct = {
  id: string;
  slug: string;
  title: string;
  price: number;
  product_images: { url: string; position: number }[];
};

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
      "*, shop:shops!inner(id, slug, name, status, whatsapp_number), product_images(url, position), product_variants(id, name, value, extra_price)"
    )
    .eq("slug", productSlug)
    .eq("shop.slug", shopSlug)
    .eq("shop.status", "active")
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (!product) notFound();

  const shop = Array.isArray(product.shop) ? product.shop[0] : product.shop;

  const { data: reviews } = await supabase
    .from("product_reviews")
    .select("customer_name, rating, comment, created_at")
    .eq("product_id", product.id)
    .order("created_at", { ascending: false });

  const shopRating = await getShopRating(supabase, shop.id);

  // Produits similaires : autres produits actifs de la même boutique,
  // catégorie identique en priorité — demandé par Isaac le 14/09/2026
  // (analyse comparative Jumia). Volontairement léger : pas de moteur de
  // recommandation, juste "le reste du catalogue du même vendeur", trié pour
  // privilégier la même catégorie quand elle existe.
  const { data: relatedRaw } = await supabase
    .from("products")
    .select("id, slug, title, price, category, product_images(url, position)")
    .eq("shop_id", shop.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .neq("id", product.id)
    .order("created_at", { ascending: false })
    .limit(12);

  const related = [...(relatedRaw ?? [])]
    .sort((a, b) => {
      const aSame = a.category === product.category ? 0 : 1;
      const bSame = b.category === product.category ? 0 : 1;
      return aSame - bSame;
    })
    .slice(0, RELATED_LIMIT) as RelatedProduct[];

  const images = [...(product.product_images ?? [])].sort((a, b) => a.position - b.position);
  const tags: string[] = product.tags ?? [];
  const hasDiscount =
    product.compare_at_price != null && product.compare_at_price > product.price;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="relative">
        <div className="absolute right-2 top-2 z-10">
          <WishlistButton
            item={{
              productId: product.id,
              shopSlug,
              productSlug: product.slug,
              title: product.title,
              price: product.price,
              imageUrl: images[0]?.url,
            }}
          />
        </div>
        <ProductGallery images={images} title={product.title} />
      </div>

      <Link href={`/${shopSlug}`} className="mt-3 inline-block text-sm text-gray-600 underline">
        {shop.name}
        {shopRating ? (
          <span className="ml-1 text-gray-500">
            — <Stars rating={shopRating.average} /> {shopRating.average.toFixed(1)}/5 (
            {shopRating.count})
          </span>
        ) : null}
      </Link>

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

      <div className="mt-3 flex flex-wrap gap-2">
        <WhatsappShareButton title={product.title} />
        {shop.whatsapp_number ? (
          <WhatsappContactButton
            whatsappNumber={shop.whatsapp_number}
            message={`Bonjour, je suis intéressé(e) par « ${product.title} ».`}
          />
        ) : null}
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

      {related.length > 0 && (
        <section className="mt-8 border-t border-gray-200 pt-4">
          <h2 className="text-sm font-medium text-gray-700">
            Autres produits de {shop.name}
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {related.map((item) => {
              const thumbnail = [...(item.product_images ?? [])].sort(
                (a, b) => a.position - b.position
              )[0]?.url;
              return (
                <Link
                  key={item.id}
                  href={`/${shopSlug}/${item.slug}`}
                  className="rounded border border-gray-200 p-2"
                >
                  {thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element -- image uploadée par le vendeur, source dynamique
                    <img
                      src={thumbnail}
                      alt={item.title}
                      className="mb-1.5 aspect-square w-full rounded object-cover"
                    />
                  ) : (
                    <div className="mb-1.5 aspect-square w-full rounded bg-gray-100" />
                  )}
                  <p className="truncate text-xs font-medium text-gray-900">{item.title}</p>
                  <p className="text-xs text-gray-600">{item.price} FCFA</p>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
