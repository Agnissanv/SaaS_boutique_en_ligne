import { fcfa } from "@/lib/utils/money";
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
import { ProductTopBar } from "./product-top-bar";
import { categoryLabel } from "@/lib/categories";
import { serializeJsonLd } from "@/lib/utils/json-ld";
import { Stars } from "@/components/stars";
import { WishlistButton } from "@/components/wishlist-button";
import { ProductImage } from "@/components/product-image";
import { getShopRating } from "@/lib/reviews";
import { WhatsappContactButton } from "@/components/whatsapp-contact-button";
import { MobileMoneyBadge } from "@/components/mobile-money-badge";
import { isMobileMoneyOperator } from "@/lib/utils/mobile-money";
import { LOW_STOCK_THRESHOLD, getEffectivePrice } from "@/lib/products";
import { RecordProductView } from "@/components/record-product-view";
import { RecentlyViewedRow } from "@/components/recently-viewed-row";
import { getCategoryAttributeFields, getAttributeValueLabel } from "@/lib/category-attributes";
import { ExpandableText } from "@/components/expandable-text";

// Même variable que `layout.tsx` et `[shopSlug]/page.tsx` (23/09/2026, ajout
// du canonical) — reprise de la convention déjà utilisée partout dans le
// projet pour les URLs absolues.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

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
      <p className="mt-3 text-sm text-encre/70">
        Aucun avis pour ce produit pour l&apos;instant.
      </p>
    );
  }

  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  return (
    <div className="mt-4">
      <p className="flex items-center gap-2 text-sm font-medium text-encre">
        <Stars rating={average} />
        <span className="tabular-nums">{average.toFixed(1)}/5</span>
        <span className="text-encre/70">({reviews.length} avis)</span>
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
      "*, shop:shops!inner(id, slug, name, status, whatsapp_number, mobile_money_number, mobile_money_operator, accent_color, delivery_fee, is_verified), product_images(url, position), product_variants(id, name, value, extra_price)"
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
    return { title: "Page introuvable — KEVA" };
  }

  const shop = Array.isArray(product.shop) ? product.shop[0] : product.shop;
  const title = `${product.title} — ${shop.name} | KEVA`;
  const description = product.description
    ? truncate(product.description, 155)
    : `${product.title} à ${fcfa(product.price)}, disponible sur la boutique ${shop.name} sur KEVA.`;
  const images = [...(product.product_images ?? [])].sort(
    (a: { position: number }, b: { position: number }) => a.position - b.position
  );
  const image = images[0]?.url || "/keva-logo-og.jpg";
  const canonicalUrl = `${siteUrl}/${shopSlug}/${productSlug}`;

  return {
    title,
    description,
    // `alternates.canonical` ajouté le 23/09/2026 (audit SEO externe) — même
    // raison que sur la page boutique : sans lui, la fiche produit héritait
    // du canonical statique de l'accueil défini dans le layout racine.
    alternates: { canonical: canonicalUrl },
    openGraph: { title, description, images: [image], type: "website", url: canonicalUrl },
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

  // Regroupées en Promise.all (30/09/2026, audit technique — voir
  // audit-technique-2026-09-29.md) : avis du produit, note de confiance de la
  // boutique et produits similaires ne dépendent que de `product.id`/`shop.id`
  // déjà connus, jamais du résultat l'une de l'autre — elles étaient awaited
  // l'une après l'autre sans raison.
  const [{ data: reviews }, shopRating, { data: relatedRaw }] = await Promise.all([
    supabase
      .from("product_reviews")
      .select("customer_name, rating, comment, created_at, order_id, seller_reply")
      .eq("product_id", product.id)
      .order("created_at", { ascending: false }),
    getShopRating(supabase, shop.id),
    // Produits similaires : autres produits actifs de la même boutique,
    // catégorie identique en priorité — demandé par Isaac le 14/09/2026
    // (analyse comparative Jumia). Volontairement léger : pas de moteur de
    // recommandation, juste "le reste du catalogue du même vendeur", trié pour
    // privilégier la même catégorie quand elle existe.
    supabase
      .from("products")
      .select("id, slug, title, price, category, product_images(url, position)")
      .eq("shop_id", shop.id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .neq("id", product.id)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

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

  // Fiche produit pour Google (13/10/2026, lot 4 UX) : prix, disponibilité et
  // note peuvent s'afficher directement dans les résultats de recherche
  // (« résultats enrichis »). Construite uniquement à partir de ce qui est
  // déjà affiché sur la page — Google pénalise un balisage qui ne correspond
  // pas au contenu visible.
  const productReviews = (reviews ?? []) as Review[];
  const productUrl = `${siteUrl}/${shopSlug}/${product.slug}`;
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    ...(product.description ? { description: truncate(product.description, 5000) } : {}),
    ...(images.length > 0 ? { image: images.map((image) => image.url) } : {}),
    sku: product.id,
    ...(product.category ? { category: categoryLabel(product.category) } : {}),
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: "XOF",
      price: effectivePrice.price,
      availability:
        product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      ...(effectivePrice.isOnSale && product.sale_ends_at
        ? { priceValidUntil: String(product.sale_ends_at).slice(0, 10) }
        : {}),
      seller: { "@type": "Organization", name: shop.name, url: `${siteUrl}/${shopSlug}` },
    },
    ...(productReviews.length > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number(
              (productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length).toFixed(1)
            ),
            reviewCount: productReviews.length,
            bestRating: 5,
            worstRating: 1,
          },
          review: productReviews.slice(0, 5).map((review) => ({
            "@type": "Review",
            author: { "@type": "Person", name: review.customer_name },
            datePublished: review.created_at.slice(0, 10),
            reviewRating: { "@type": "Rating", ratingValue: review.rating, bestRating: 5, worstRating: 1 },
            ...(review.comment ? { reviewBody: review.comment } : {}),
          })),
        }
      : {}),
  };

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
      {/* Téléphone : barre du haut (retour, boutique, partager, panier).
          Ordinateur : fil d'Ariane (13/10/2026, lot 2 UX — remplace le
          simple lien « Retour à la boutique » et le chevron posé sur la
          photo). Doublé d'un BreadcrumbList pour Google. */}
      <ProductTopBar shopSlug={shopSlug} shopName={shop.name} productTitle={product.title} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Accueil", item: siteUrl },
              ...(product.category
                ? [
                    {
                      "@type": "ListItem",
                      position: 2,
                      name: categoryLabel(product.category),
                      item: `${siteUrl}/?categorie=${product.category}`,
                    },
                  ]
                : []),
              {
                "@type": "ListItem",
                position: product.category ? 3 : 2,
                name: shop.name,
                item: `${siteUrl}/${shopSlug}`,
              },
              {
                "@type": "ListItem",
                position: product.category ? 4 : 3,
                name: product.title,
                item: `${siteUrl}/${shopSlug}/${product.slug}`,
              },
            ],
          }),
        }}
      />
      <nav aria-label="Fil d'Ariane" className="hidden text-sm text-encre/70 sm:block">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="transition-colors hover:text-vert-actif">
              Accueil
            </Link>
          </li>
          {product.category ? (
            <>
              <li aria-hidden="true">›</li>
              <li>
                <Link
                  href={`/?categorie=${encodeURIComponent(product.category)}`}
                  className="transition-colors hover:text-vert-actif"
                >
                  {categoryLabel(product.category)}
                </Link>
              </li>
            </>
          ) : null}
          <li aria-hidden="true">›</li>
          <li>
            <Link href={`/${shopSlug}`} transitionTypes={["nav-back"]} className="transition-colors hover:text-vert-actif">
              {shop.name}
            </Link>
          </li>
          <li aria-hidden="true">›</li>
          <li aria-current="page" className="max-w-[28ch] truncate font-medium text-encre">
            {product.title}
          </li>
        </ol>
      </nav>

      <div className="mt-0 grid gap-8 sm:mt-4 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
        <div className="relative">
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
              className="flex items-center gap-2 font-medium text-vert-actif hover:text-vert-sapin transition-colors"
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
              <span className="flex items-center gap-1 text-encre/70">
                · <Stars rating={shopRating.average} /> {shopRating.average.toFixed(1)} (
                {shopRating.count})
              </span>
            ) : null}
            <span className="ml-auto hidden sm:inline-flex">
              <WhatsappShareButton title={product.title} />
            </span>
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
          {/* Limitée à 4 lignes + « Lire la suite » (13/10/2026, lot 4 UX) :
              une longue description repoussait le prix et « Ajouter au
              panier » sous le premier écran, et ses retours à la ligne
              étaient perdus. Le texte complet reste dans la page (Google). */}
          {product.description ? (
            <ExpandableText
              text={product.description}
              lines={4}
              className="mt-3 text-[15px] leading-relaxed text-encre/70"
            />
          ) : null}

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
            <p className="font-display text-[1.75rem] font-extrabold leading-none tracking-tight tabular-nums text-vert-actif">
              {fcfa(effectivePrice.price)}
            </p>
            {hasDiscount && (
              <>
                <p className="tabular-nums text-sm text-encre/70 line-through">
                  {fcfa(effectivePrice.compareAtPrice)}
                </p>
                <span className="rounded-full bg-erreur px-2 py-0.5 text-xs font-semibold text-ivoire">
                  −{discountPercent} %
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
            {/* Réassurance au moment de la décision d'achat (13/10/2026) :
                uniquement des faits vérifiables — paiement à la livraison
                (seul mode actif), vrai tarif de livraison du vendeur, badge
                vérifié seulement s'il l'est. */}
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-encre/80">
              <li className="flex items-center gap-1.5">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4 text-vert-actif">
                  <rect x="2.5" y="5.5" width="15" height="9" rx="1.5" />
                  <circle cx="10" cy="10" r="2" />
                </svg>
                Paiement à la livraison
              </li>
              <li className="flex items-center gap-1.5">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4 text-vert-actif">
                  <rect x="1.5" y="6" width="10" height="8" rx="1" />
                  <path d="M11.5 9h3l2.5 2.5V14h-5.5" />
                  <circle cx="5" cy="15" r="1.3" />
                  <circle cx="14.5" cy="15" r="1.3" />
                </svg>
                {shop.delivery_fee == null
                  ? "Livraison à convenir avec le vendeur"
                  : shop.delivery_fee === 0
                    ? "Livraison gratuite"
                    : `Livraison ${fcfa(shop.delivery_fee)}`}
              </li>
              {shop.is_verified ? (
                <li className="flex items-center gap-1.5">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4 text-vert-actif">
                    <path d="M10 2.5 16 5v4.5c0 3.6-2.5 6.6-6 8-3.5-1.4-6-4.4-6-8V5l6-2.5Z" />
                    <path d="m7.2 10 2 2 3.6-3.8" />
                  </svg>
                  Boutique vérifiée
                </li>
              ) : null}
            </ul>
            {/* Bouton secondaire (13/10/2026, lot 2 UX) : « Ajouter au panier »
                reste le seul bouton principal. Formulé « poser une question »
                plutôt que « commander » : la commande passe par KEVA, pour que
                le vendeur la retrouve dans son tableau de bord. */}
            {shop.whatsapp_number ? (
              <div className="mt-4">
                <WhatsappContactButton
                  whatsappNumber={shop.whatsapp_number}
                  message={`Bonjour, j'ai une question sur « ${product.title} » vu sur KEVA.`}
                  label="Poser une question sur WhatsApp"
                  variant="outline"
                />
              </div>
            ) : null}
          </div>

          {/* Numéro Mobile Money du vendeur (29/09/2026), purement informatif :
              placé après les boutons d'achat (13/10/2026) pour ne pas les
              séparer du prix. */}
          {shop.mobile_money_number && shop.mobile_money_operator && isMobileMoneyOperator(shop.mobile_money_operator) ? (
            <div className="mt-3">
              <MobileMoneyBadge
                operator={shop.mobile_money_operator}
                number={shop.mobile_money_number}
              />
            </div>
          ) : null}
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
                <dt className="text-encre/70">{spec.label}</dt>
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
                  <p className="font-display font-bold tabular-nums text-xs text-vert-actif">{fcfa(item.price)}</p>
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
