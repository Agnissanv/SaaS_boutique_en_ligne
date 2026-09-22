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
import { LOW_STOCK_THRESHOLD, getEffectivePrice } from "@/lib/products";
import { RecordProductView } from "@/components/record-product-view";
import { RecentlyViewedRow } from "@/components/recently-viewed-row";
import { getCategoryAttributeFields, getAttributeValueLabel } from "@/lib/category-attributes";

const RELATED_LIMIT = 4;

type Review = {
  customer_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
  order_id: string | null;
  seller_reply: string | null;
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

/**
 * Note moyenne + liste des avis (cf. migration 0011, submit_product_review).
 * Réponse vendeur (migration 0028, tâche #78 du 21/09/2026) affichée sous le
 * commentaire du client, visuellement rattachée (fond `brume`, léger
 * décalage) pour bien la distinguer de l'avis lui-même — jamais confondue
 * avec un second avis.
 */
function ReviewsSection({ reviews, shopName }: { reviews: Review[]; shopName: string }) {
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
            {review.seller_reply && (
              <div className="mt-3 rounded-md bg-brume p-3">
                <p className="text-xs font-medium text-encre/70">Réponse de {shopName}</p>
                <p className="mt-1 text-sm leading-relaxed text-encre/80">
                  {review.seller_reply}
                </p>
              </div>
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
    .select("customer_name, rating, comment, created_at, order_id, seller_reply")
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
  const highlights: string[] = product.highlights ?? [];
  // Spécifications par catégorie — ajouté le 22/09/2026 (voir
  // category-attributes.ts). Seuls les champs prévus pour la catégorie DE CE
  // PRODUIT et effectivement renseignés par le vendeur sont affichés — l'ordre
  // suit celui du formulaire vendeur, pas l'ordre d'insertion dans le JSON.
  const productAttributes: Record<string, string> = product.attributes ?? {};
  const specs = getCategoryAttributeFields(product.category)
    .filter((field) => Boolean(productAttributes[field.key]))
    .map((field) => ({
      label: field.label,
      value: getAttributeValueLabel(product.category, field.key, productAttributes[field.key]),
    }));
  // Prix effectif (soldé si une promo datée est active maintenant, sinon le
  // prix normal) — voir migration 0031 pour le contexte complet. C'est aussi
  // ce prix qui doit être transmis à `AddToCartForm`/`StickyAddToCartBar` :
  // le montant réellement facturé est de toute façon recalculé côté serveur
  // par `create_order` (jamais celui envoyé par le client), mais le panier
  // doit refléter la même promo que ce que le client vient de voir.
  const effectivePrice = getEffectivePrice({
    price: product.price,
    compareAtPrice: product.compare_at_price,
    salePrice: product.sale_price,
    saleStartsAt: product.sale_starts_at,
    saleEndsAt: product.sale_ends_at,
  });
  const hasDiscount =
    effectivePrice.compareAtPrice != null && effectivePrice.compareAtPrice > effectivePrice.price;
  const discountPercent = hasDiscount
    ? Math.round((1 - effectivePrice.price / (effectivePrice.compareAtPrice as number)) * 100)
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
          price: effectivePrice.price,
          compareAtPrice: effectivePrice.compareAtPrice,
          imageUrl: images[0]?.url,
        }}
      />
      {/* Lien retour : caché sur mobile au profit du chevron flottant sur la
          photo ci-dessous (refonte fiche produit, 22/09/2026, mockup validé
          par Isaac) — repris à partir de sm:, où la mise en page à deux
          colonnes laisse assez de place au-dessus de la galerie. */}
      <Link
        href={`/${shopSlug}`}
        transitionTypes={["nav-back"]}
        className="hidden items-center gap-1 text-sm text-vert-actif hover:underline sm:inline-flex"
      >
        ‹ Retour à la boutique
      </Link>

      <div className="mt-0 grid gap-8 sm:mt-4 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
        <div className="relative">
          <Link
            href={`/${shopSlug}`}
            transitionTypes={["nav-back"]}
            aria-label="Retour à la boutique"
            className="absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg text-vert-sapin shadow-sm sm:hidden"
          >
            ‹
          </Link>
          <div className="absolute right-3 top-3 z-10">
            <WishlistButton
              item={{
                productId: product.id,
                shopSlug,
                productSlug: product.slug,
                title: product.title,
                price: effectivePrice.price,
                compareAtPrice: effectivePrice.compareAtPrice,
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
                  className="rounded-full bg-brume px-2.5 py-1 text-xs font-medium text-vert-actif"
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

          {/* "Points forts" — ajouté le 22/09/2026 (migration 0031), demandé
              par Isaac sur inspiration Jumia : quelques atouts courts mis en
              avant, distincts de la description longue ci-dessus. */}
          {highlights.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1">
              {highlights.map((point, index) => (
                <li key={index} className="flex items-start gap-1.5 text-sm text-encre/80">
                  <span aria-hidden="true" className="mt-0.5 text-vert-actif">✓</span>
                  {point}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 flex flex-wrap items-baseline gap-2.5">
            <p className="font-mono text-2xl font-semibold text-vert-actif">
              {effectivePrice.price} FCFA
            </p>
            {hasDiscount && (
              <>
                <p className="font-mono text-sm text-encre/40 line-through">
                  {effectivePrice.compareAtPrice} FCFA
                </p>
                <span className="rounded-full bg-erreur px-2 py-0.5 text-xs font-semibold text-ivoire">
                  -{discountPercent}%
                </span>
              </>
            )}
            {effectivePrice.isOnSale && (
              <span className="rounded-full bg-erreur/15 px-2 py-0.5 text-xs font-semibold text-erreur">
                Promo en cours
              </span>
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
              price={effectivePrice.price}
              imageUrl={images[0]?.url}
              variants={product.product_variants ?? []}
              stock={product.stock}
              accentColor={shop.accent_color}
            />
          </div>
        </div>
      </div>

      <StickyAddToCartBar
        price={effectivePrice.price}
        stock={product.stock}
        accentColor={shop.accent_color}
      />

      {/* Tableau "Spécifications" — ajouté le 22/09/2026, en même temps que
          les champs dynamiques par catégorie du formulaire vendeur (voir
          category-attributes.ts). N'apparaît que si le produit a une
          catégorie couverte par ce système ET qu'au moins un champ a été
          renseigné — jamais de section vide. */}
      {specs.length > 0 && (
        <section className="mt-10 border-t border-ligne pt-8">
          <h2 className="font-display text-lg font-semibold text-encre">Spécifications</h2>
          <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
            {specs.map((spec) => (
              <div
                key={spec.label}
                className="flex items-baseline justify-between gap-3 border-b border-ligne/60 py-2 text-sm sm:justify-start"
              >
                <dt className="text-encre/60">{spec.label}</dt>
                <dd className="text-right font-medium text-encre sm:ml-auto">{spec.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="mt-12 border-t border-ligne pt-8">
        <h2 className="font-display text-lg font-semibold text-encre">Avis clients</h2>
        <ReviewsSection reviews={reviews ?? []} shopName={shop.name} />
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
                  className="group rounded-lg border border-ligne bg-white p-2 transition hover:border-vert-actif"
                >
                  <ViewTransition name={`product-photo-${item.id}`} share="morph" default="none">
                    <ProductImage
                      src={thumbnail}
                      alt={item.title}
                      className="mb-2 aspect-square w-full rounded-md object-cover"
                    />
                  </ViewTransition>
                  <p className="truncate text-xs font-medium text-encre">{item.title}</p>
                  <p className="font-mono text-xs text-vert-actif">{item.price} FCFA</p>
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
