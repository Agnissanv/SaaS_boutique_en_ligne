import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, ViewTransition } from "react";
import { createClient } from "@/lib/supabase/server";
import { truncate } from "@/lib/utils/text";
import { AddToCartForm } from "./add-to-cart-form";
import { StickyAddToCartBar } from "./sticky-add-to-cart-bar";
import { ProductGallery } from "./product-gallery";
import { WhatsappShareButton } from "./whatsapp-share-button";
import { Stars } from "@/components/stars";
import { WishlistButton } from "@/components/wishlist-button";
import { ProductImage } from "@/components/product-image";
import { getShopRating } from "@/lib/reviews";
import { WhatsappContactButton } from "@/components/whatsapp-contact-button";
import { LOW_STOCK_THRESHOLD } from "@/lib/products";
import { RecordProductView } from "@/components/record-product-view";
import { RecentlyViewedRow } from "@/components/recently-viewed-row";

const RELATED_LIMIT = 4;

type Review = {
  customer_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
  order_id: string | null;
};

/**
 * Badge "Achat vérifié" — ajouté le 21/09/2026 (cahier des charges, avis
 * clients). Contrairement au badge "vendeur vérifié" volontairement écarté
 * plus haut sur la page boutique (aucun système de vérification vendeur
 * n'existe), celui-ci n'est pas un mensonge visuel : la migration 0011
 * (`submit_product_review`) interdit déjà tout avis qui ne correspond pas à
 * une commande réelle contenant ce produit — `order_id` est donc une vraie
 * preuve d'achat, pas une déclaration sur l'honneur. Un avis sans `order_id`
 * ne devrait normalement jamais exister (aucune policy ne permet d'insérer
 * autrement), sauf commande supprimée entre-temps (`on delete set null`) —
 * dans ce cas rare, le badge disparaît simplement plutôt que d'afficher une
 * preuve qu'on ne peut plus vérifier.
 */
function VerifiedPurchaseBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-succes/15 px-2 py-0.5 text-[11px] font-medium text-succes">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
        <circle cx="10" cy="10" r="7" />
        <path d="M7 10.2l2 2 4-4.4" />
      </svg>
      Achat vérifié
    </span>
  );
}

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
      <p className="mt-3 text-sm text-encre/50">
        Aucun avis pour ce produit pour l&apos;instant.
      </p>
    );
  }

  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  return (
    <div className="mt-4">
      <p className="flex items-center gap-2 text-sm font-medium text-encre">
        <Stars rating={average} />
        <span className="font-mono">{average.toFixed(1)}/5</span>
        <span className="text-encre/50">({reviews.length} avis)</span>
      </p>
      <ul className="mt-4 flex flex-col gap-3">
        {reviews.map((review, index) => (
          <li key={index} className="rounded-lg border border-ligne bg-white p-4">
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-encre">
              <Stars rating={review.rating} /> {review.customer_name}
              {review.order_id ? <VerifiedPurchaseBadge /> : null}
            </p>
            {review.comment && (
              <p className="mt-1.5 text-sm leading-relaxed text-encre/70">{review.comment}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// `cache()` (React) : même raisonnement que `getShopForPublicPage` dans la
// page boutique — mémoïse la requête produit pour la durée d'une seule
// requête serveur, partagée entre `generateMetadata` et le composant de page
// ci-dessous plutôt que dupliquée. Ajoutée le 16/09/2026 en même temps que
// `generateMetadata`.
const getProductForPublicPage = cache(async (shopSlug: string, productSlug: string) => {
  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select(
      "*, shop:shops!inner(id, slug, name, status, whatsapp_number, accent_color), product_images(url, position), product_variants(id, name, value, extra_price)"
    )
    .eq("slug", productSlug)
    .eq("shop.slug", shopSlug)
    .eq("shop.status", "active")
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  return product;
});

/**
 * Métadonnées + carte de partage (Open Graph/Twitter) — ajoutées le
 * 16/09/2026, même raisonnement que la page boutique (voir
 * `[shopSlug]/page.tsx`) : le bouton "Partager sur WhatsApp" de cette même
 * page (`whatsapp-share-button.tsx`) envoyait déjà un lien produit, mais sans
 * ces balises ce lien s'affichait sans aucune vignette côté destinataire.
 * Repli sur la première photo produit, puis la boutique, puis le logo KEVA.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ shopSlug: string; productSlug: string }>;
}): Promise<Metadata> {
  const { shopSlug, productSlug } = await params;
  const product = await getProductForPublicPage(shopSlug, productSlug);

  if (!product) {
    return { title: "Produit introuvable — KEVA" };
  }

  const shop = Array.isArray(product.shop) ? product.shop[0] : product.shop;
  const title = `${product.title} — ${shop.name} | KEVA`;
  const description = product.description
    ? truncate(product.description, 155)
    : `${product.title} à ${product.price} FCFA, disponible sur la boutique ${shop.name} sur KEVA.`;
  const images = [...(product.product_images ?? [])].sort(
    (a: { position: number }, b: { position: number }) => a.position - b.position
  );
  const image = images[0]?.url || "/keva-logo.jpg";

  return {
    title,
    description,
    openGraph: { title, description, images: [image], type: "website" },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ shopSlug: string; productSlug: string }>;
}) {
  const { shopSlug, productSlug } = await params;
  const product = await getProductForPublicPage(shopSlug, productSlug);
  if (!product) notFound();

  const supabase = await createClient();

  // Compteur de vues PAR PRODUIT (plan Business+, "produits les plus vus" —
  // ajouté le 16/09/2026, voir migration 0025_advanced_stats.sql). Même
  // principe que `increment_shop_view` (migration 0005) : simple incrément,
  // pas de déduplication par visiteur, erreur ignorée pour ne jamais bloquer
  // l'affichage de la fiche produit.
  await supabase.rpc("increment_product_view", { p_product_id: product.id });

  const shop = Array.isArray(product.shop) ? product.shop[0] : product.shop;

  const { data: reviews } = await supabase
    .from("product_reviews")
    .select("customer_name, rating, comment, created_at, order_id")
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
  const discountPercent = hasDiscount
    ? Math.round((1 - product.price / product.compare_at_price) * 100)
    : null;

  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
    <ViewTransition enter="kv-content-in" default="none">
    <main className="w-full mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <RecordProductView
        item={{
          productId: product.id,
          shopSlug,
          shopName: shop.name,
          productSlug: product.slug,
          title: product.title,
          price: product.price,
          compareAtPrice: product.compare_at_price,
          imageUrl: images[0]?.url,
        }}
      />
      <Link
        href={`/${shopSlug}`}
        transitionTypes={["nav-back"]}
        className="inline-flex items-center gap-1 text-sm text-vert-actif hover:underline"
      >
        ‹ Retour à la boutique
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
        <div className="relative">
          <div className="absolute right-3 top-3 z-10">
            <WishlistButton
              item={{
                productId: product.id,
                shopSlug,
                productSlug: product.slug,
                title: product.title,
                price: product.price,
                compareAtPrice: product.compare_at_price,
                imageUrl: images[0]?.url,
              }}
            />
          </div>
          <ProductGallery images={images} title={product.title} productId={product.id} />
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              href={`/${shopSlug}`}
              className="flex items-center gap-2 font-medium text-vert-actif hover:underline"
            >
              <span
                aria-hidden="true"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-vert-sapin text-xs font-semibold text-ivoire"
              >
                {shop.name.charAt(0).toUpperCase()}
              </span>
              {shop.name}
            </Link>
            {shopRating ? (
              <span className="flex items-center gap-1 text-encre/50">
                · <Stars rating={shopRating.average} /> {shopRating.average.toFixed(1)} (
                {shopRating.count})
              </span>
            ) : null}
          </div>

          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-sable px-2.5 py-1 text-xs font-medium text-cuivre-profond"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <h1 className="mt-3 font-display text-2xl font-semibold text-encre sm:text-3xl">
            {product.title}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-encre/70">{product.description}</p>

          <div className="mt-5 flex flex-wrap items-baseline gap-2.5">
            <p className="font-mono text-2xl font-semibold text-cuivre-profond">
              {product.price} FCFA
            </p>
            {hasDiscount && (
              <>
                <p className="font-mono text-sm text-encre/40 line-through">
                  {product.compare_at_price} FCFA
                </p>
                <span className="rounded-full bg-erreur px-2 py-0.5 text-xs font-semibold text-ivoire">
                  -{discountPercent}%
                </span>
              </>
            )}
          </div>

          {product.stock <= 0 ? (
            <p className="mt-2 text-sm font-medium text-erreur">Rupture de stock</p>
          ) : product.stock <= LOW_STOCK_THRESHOLD ? (
            <p className="mt-2 text-sm font-medium text-attention">
              Plus que {product.stock} en stock
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <WhatsappShareButton title={product.title} />
            {shop.whatsapp_number ? (
              <WhatsappContactButton
                whatsappNumber={shop.whatsapp_number}
                message={`Bonjour, je suis intéressé(e) par « ${product.title} ».`}
              />
            ) : null}
          </div>

          {/* `id="acheter"` : cible du scroll de la barre fixe mobile
              (`sticky-add-to-cart-bar.tsx`), voir son commentaire pour le
              raisonnement complet. */}
          <div id="acheter" className="scroll-mt-4">
            <AddToCartForm
              shopSlug={shopSlug}
              productId={product.id}
              productSlug={product.slug}
              title={product.title}
              price={product.price}
              imageUrl={images[0]?.url}
              variants={product.product_variants ?? []}
              stock={product.stock}
              accentColor={shop.accent_color}
            />
          </div>
        </div>
      </div>

      <StickyAddToCartBar
        price={product.price}
        stock={product.stock}
        accentColor={shop.accent_color}
      />

      <section className="mt-12 border-t border-ligne pt-8">
        <h2 className="font-display text-lg font-semibold text-encre">Avis clients</h2>
        <ReviewsSection reviews={reviews ?? []} />
      </section>

      {related.length > 0 && (
        <section className="mt-10 border-t border-ligne pt-8">
          <h2 className="font-display text-lg font-semibold text-encre">
            Autres produits de {shop.name}
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {related.map((item) => {
              const thumbnail = [...(item.product_images ?? [])].sort(
                (a, b) => a.position - b.position
              )[0]?.url;
              return (
                <Link
                  key={item.id}
                  href={`/${shopSlug}/${item.slug}`}
                  transitionTypes={["nav-forward"]}
                  className="group rounded-lg border border-ligne bg-white p-2 transition hover:border-cuivre"
                >
                  <ViewTransition name={`product-photo-${item.id}`} share="morph" default="none">
                    <ProductImage
                      src={thumbnail}
                      alt={item.title}
                      className="mb-2 aspect-square w-full rounded-md object-cover"
                    />
                  </ViewTransition>
                  <p className="truncate text-xs font-medium text-encre">{item.title}</p>
                  <p className="font-mono text-xs text-cuivre-profond">{item.price} FCFA</p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <RecentlyViewedRow excludeProductId={product.id} />
    </main>
    </ViewTransition>
    </ViewTransition>
  );
}
