import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { cache, ViewTransition } from "react";
import { createClient } from "@/lib/supabase/server";
import { truncate } from "@/lib/utils/text";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
type CategoryTile = { value: string; label: string };
import { CartLink } from "./cart-link";
import { SortSelect } from "@/components/sort-select";
import { Stars } from "@/components/stars";
import { getShopRating } from "@/lib/reviews";
import { WishlistButton } from "@/components/wishlist-button";
import { WhatsappContactButton } from "@/components/whatsapp-contact-button";
import { ProductImage } from "@/components/product-image";
import { getEffectivePrice } from "@/lib/products";

type PublicProduct = {
  id: string;
  slug: string;
  title: string;
  price: number;
  compare_at_price: number | null;
  category: string | null;
  product_images: { url: string; position: number }[];
  // Prix soldé daté — ajouté le 22/09/2026 (migration 0031). Voir
  // `getEffectivePrice` (src/lib/products.ts).
  sale_price: number | null;
  sale_starts_at: string | null;
  sale_ends_at: string | null;
};

const PAGE_SIZE = 24;

const SORTS = [
  { value: "recent", label: "Plus récent" },
  { value: "prix_asc", label: "Prix croissant" },
  { value: "prix_desc", label: "Prix décroissant" },
] as const;
type SortValue = (typeof SORTS)[number]["value"];

function buildHref(
  shopSlug: string,
  current: { q?: string; categorie?: string; tri?: string; page?: string },
  overrides: { q?: string; categorie?: string; tri?: string; page?: string }
) {
  const params = new URLSearchParams();
  const merged = { ...current, ...overrides };
  if (merged.q) params.set("q", merged.q);
  if (merged.categorie) params.set("categorie", merged.categorie);
  if (merged.tri && merged.tri !== "recent") params.set("tri", merged.tri);
  if (merged.page && merged.page !== "1") params.set("page", merged.page);
  const qs = params.toString();
  return qs ? `/${shopSlug}?${qs}` : `/${shopSlug}`;
}

/** Libellé du bloc "Livraison" — jamais un chiffre inventé : soit le vrai
 * tarif renseigné par le vendeur (`shops.delivery_fee`, migration
 * 0012_delivery_fee_and_notifications.sql), soit une mention honnête qu'il
 * reste à négocier, jamais un texte générique qui laisserait croire à un
 * tarif fixe qui n'existe pas. */
function deliveryLabel(fee: number | null): string {
  if (fee === null) return "À négocier avec le vendeur";
  if (fee === 0) return "Livraison gratuite";
  return `${fee} FCFA`;
}

// `cache()` (React) : mémoïse cette requête pour la durée d'une seule
// requête serveur, afin que `generateMetadata` et le composant de page
// ci-dessous — tous deux exécutés par Next.js pour la même navigation —
// partagent le même appel Supabase au lieu de le dupliquer. Ajouté le
// 16/09/2026 en même temps que `generateMetadata` : avant, la boutique
// n'était chargée qu'une fois, dans la page elle-même.
const getShopForPublicPage = cache(async (shopSlug: string) => {
  const supabase = await createClient();
  const { data: shop } = await supabase
    .from("shops")
    .select(
      "id, name, description, logo_url, cover_url, whatsapp_number, delivery_fee, accent_color"
    )
    .eq("slug", shopSlug)
    .eq("status", "active")
    .maybeSingle();
  return shop;
});

/**
 * Métadonnées + carte de partage (Open Graph/Twitter) — ajoutées le
 * 16/09/2026. Isaac, en comparant KEVA à la concurrence : le lien de
 * boutique est le principal canal de croissance du produit (cf. cahier des
 * charges §1.4, "expérience WhatsApp native"), or sans ces balises, un lien
 * collé dans un statut WhatsApp ou une story Instagram n'affichait qu'une
 * carte vide ou générique — aucune vignette, aucun nom de boutique. Repli
 * sur le logo si la boutique n'a pas de photo de couverture, puis sur le
 * logo KEVA (jamais un rectangle vide) si elle n'a ni l'un ni l'autre.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ shopSlug: string }>;
}): Promise<Metadata> {
  const { shopSlug } = await params;
  const shop = await getShopForPublicPage(shopSlug);

  if (!shop) {
    return { title: "Boutique introuvable — KEVA" };
  }

  const title = `${shop.name} — Boutique KEVA`;
  const description = shop.description
    ? truncate(shop.description, 155)
    : `Découvre les produits de ${shop.name} sur KEVA : commande sans compte, paiement à la livraison.`;
  const image = shop.cover_url || shop.logo_url || "/keva-logo.jpg";

  return {
    title,
    description,
    openGraph: { title, description, images: [image], type: "website" },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

/**
 * Page boutique publique — catalogue produits d'un vendeur, lien que chaque
 * commerçant partage à ses clients (WhatsApp, Instagram, bio...).
 * Route : /[shopSlug]  (ex: /boutique-de-fatou)
 *
 * Recherche + filtre catégorie + tri ajoutés le 14/09/2026 : le cahier des
 * charges §3.1.B.2 prévoyait déjà un "catalogue des produits avec filtres
 * simples" en Priorité 1, mais ce n'était en réalité jamais construit — la
 * page n'était qu'une grille brute, contrairement à la marketplace globale
 * (src/app/page.tsx) qui avait déjà recherche + filtre catégorie. Repris ici
 * en suivant le même pattern (même construction de query) pour rester
 * cohérent, avec en plus un tri par prix, absent des deux pages jusqu'ici.
 *
 * Refonte visuelle du 15/09/2026, dans la continuité de la refonte du
 * dashboard vendeur (sidebar, filtres/tri produits) faite le même jour :
 * Isaac a demandé d'appliquer la même exigence de finition à cette page,
 * puisque c'est celle que le commerçant montre réellement à ses clients.
 * Deux changements principaux, tranchés avec Isaac avant de coder :
 * - Mise en page élargie (max-w-6xl au lieu de max-w-4xl, jusqu'à 5 colonnes
 *   de produits sur desktop), pour ressembler davantage à une vraie boutique
 *   en ligne plutôt qu'à une liste étroite.
 * - Bloc de confiance ajouté sous l'identité de la boutique (paiement à la
 *   livraison, frais de livraison, contact direct) — inspiré de
 *   l'argumentaire de confiance déjà présent sur la page d'accueil
 *   marketplace (13/09/2026), adapté à une seule boutique. Aucune donnée
 *   inventée : le tarif de livraison affiché est le vrai
 *   `shops.delivery_fee` renseigné par le vendeur, ou une mention explicite
 *   qu'il reste à négocier — jamais un chiffre par défaut fabriqué. Pas de
 *   badge "vendeur vérifié" ou similaire : aucun système de vérification
 *   n'existe côté KEVA, un tel badge serait un mensonge visuel.
 */
export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopSlug: string }>;
  searchParams: Promise<{ q?: string; categorie?: string; tri?: string; page?: string }>;
}) {
  const { shopSlug } = await params;
  const { q, categorie, tri, page: pageParam } = await searchParams;
  const sort: SortValue = SORTS.some((s) => s.value === tri) ? (tri as SortValue) : "recent";
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const shop = await getShopForPublicPage(shopSlug);
  if (!shop) notFound();

  const supabase = await createClient();

  const rating = await getShopRating(supabase, shop.id);

  // Compteur de vues (cf. cahier des charges §3.1.A.4) : simple incrément,
  // pas de déduplication par visiteur — voir 0005_shop_stats.sql. On ignore
  // volontairement une éventuelle erreur : ça ne doit jamais empêcher
  // l'affichage de la boutique.
  await supabase.rpc("increment_shop_view", { p_shop_slug: shopSlug });

  let query = supabase
    .from("products")
    .select(
      "id, slug, title, price, compare_at_price, category, product_images(url, position), sale_price, sale_starts_at, sale_ends_at",
      { count: "exact" }
    )
    .eq("shop_id", shop.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .range(from, to);

  if (q) query = query.ilike("title", `%${q}%`);
  if (categorie) query = query.eq("category", categorie);
  if (sort === "prix_asc") query = query.order("price", { ascending: true });
  else if (sort === "prix_desc") query = query.order("price", { ascending: false });
  else query = query.order("created_at", { ascending: false });

  const { data: products, count } = await query;

  // Catégories réellement disponibles dans cette boutique (16/09/2026,
  // retour d'Isaac : "les catégories de filtre présentes sur les boutiques
  // ne doivent pas s'afficher toutes, seulement celles qui sont dispo sur
  // la boutique du vendeur") — même raisonnement et même requête minimale
  // (une seule colonne) que pour la marketplace globale (`src/app/page.tsx`).
  // Calculée sur TOUS les produits actifs de la boutique, pas seulement la
  // page courante de résultats — sinon les chips changeraient selon la page
  // affichée, ce qui serait déroutant.
  const { data: shopCategoriesRaw } = await supabase
    .from("products")
    .select("category")
    .eq("shop_id", shop.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .not("category", "is", null);
  const shopCategoryValues = new Set(
    ((shopCategoriesRaw ?? []) as { category: string | null }[])
      .map((p) => p.category)
      .filter((c): c is string => Boolean(c))
  );
  const availableCategories: CategoryTile[] = CATEGORIES.filter((c) =>
    shopCategoryValues.has(c.value)
  );

  // Note/nombre d'avis sur les cartes produit de la grille boutique
  // (16/09/2026, voir migration 0027_product_ratings_on_listing.sql et le
  // même raisonnement appliqué à la marketplace dans `page.tsx`) — un seul
  // appel groupé pour toute la page (au plus `PAGE_SIZE` produits).
  const productIds = (products ?? []).map((p) => p.id);
  const ratingsByProduct = new Map<string, { average: number; count: number }>();
  if (productIds.length > 0) {
    const { data: ratingsRaw } = await supabase.rpc("get_products_ratings", {
      p_product_ids: productIds,
    });
    for (const r of (ratingsRaw ?? []) as {
      product_id: string;
      average: number;
      review_count: number;
    }[]) {
      ratingsByProduct.set(r.product_id, { average: r.average, count: r.review_count });
    }
  }

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;
  const current = { q, categorie, tri, page: pageParam };

  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
    <ViewTransition enter="kv-content-in" default="none">
    <main className="w-full mx-auto max-w-6xl px-4 py-6 sm:py-8">
      {/* Lien retour marketplace ajouté le 16/09/2026 (retour d'Isaac : "étant
          sur une boutique le visiteur ne peut pas aller sur la marketplace")
          — sur mobile, la barre de navigation basse (bottom-nav.tsx) permet
          déjà de revenir à l'accueil via son onglet "Accueil", mais elle est
          masquée dès le breakpoint tablette (`sm:hidden`) : sans ce lien, un
          visiteur desktop arrivant directement sur une boutique (lien
          WhatsApp, par ex.) n'avait tout simplement aucun moyen de rejoindre
          les autres boutiques de la plateforme. `transitionTypes={["nav-back"]}`
          : même mouvement que le lien "Accueil" de la barre basse, on
          remonte dans la hiérarchie plutôt que d'avancer. */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <Link
          href="/"
          transitionTypes={["nav-back"]}
          className="text-xs font-medium text-vert-actif underline"
        >
          ← Toutes les boutiques
        </Link>
        <Link href="/compte" className="text-xs text-vert-actif underline">
          Mon compte
        </Link>
      </div>

      {/* Bannière — image de couverture du vendeur si renseignée, sinon un
          fond vert profond neutre plutôt qu'un blanc vide. Passée à
          next/image le 16/09/2026 (enrichissement performance) : c'est
          l'image la plus lourde de toute la page boutique, la première que
          le navigateur doit charger — voir `product-image.tsx` pour le même
          raisonnement appliqué aux vignettes produit. */}
      <div className="overflow-hidden rounded-xl">
        {shop.cover_url ? (
          <div className="relative h-40 w-full sm:h-56">
            <Image
              src={shop.cover_url}
              alt=""
              fill
              priority
              sizes="(min-width: 1024px) 1024px, 100vw"
              className="object-cover"
            />
          </div>
        ) : (
          <div
            style={shop.accent_color ? { backgroundColor: shop.accent_color } : undefined}
            className={shop.accent_color ? "h-24 w-full sm:h-32" : "h-24 w-full bg-vert-profond sm:h-32"}
          />
        )}
      </div>

      {/* Carte d'identité — chevauche légèrement la bannière (repère visuel
          de boutique en ligne, comme une page vendeur Jumia/Etsy) et
          regroupe logo, note de confiance mise en avant, description,
          contact direct et le bloc de confiance. */}
      <div className="relative z-10 -mt-8 rounded-xl border border-ligne bg-white p-4 shadow-sm sm:-mt-12 sm:p-6">
        <div className="flex flex-wrap items-start gap-4">
          {shop.logo_url ? (
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-4 border-white shadow sm:h-20 sm:w-20">
              <Image src={shop.logo_url} alt={shop.name} fill sizes="80px" className="object-cover" />
            </div>
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-white bg-sable text-xl font-semibold text-cuivre-profond shadow sm:h-20 sm:w-20">
              {shop.name.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-semibold text-encre sm:text-2xl">
              {shop.name}
            </h1>
            {rating ? (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-encre/70">
                <Stars rating={rating.average} />
                <span className="font-medium text-encre">{rating.average.toFixed(1)}/5</span>
                <span>({rating.count} avis)</span>
              </p>
            ) : (
              <p className="mt-1 text-xs text-encre/50">Pas encore d&apos;avis</p>
            )}
            {shop.description ? (
              <p className="mt-2 text-sm text-encre/70">{shop.description}</p>
            ) : null}
          </div>

          {shop.whatsapp_number ? (
            <div className="w-full sm:w-auto">
              <WhatsappContactButton
                whatsappNumber={shop.whatsapp_number}
                message={`Bonjour, j'ai une question sur votre boutique « ${shop.name} ».`}
              />
            </div>
          ) : null}
        </div>

        {/* Bloc de confiance — adapté de l'argumentaire déjà présent sur la
            page d'accueil marketplace (13/09/2026), pour une seule boutique.
            Toujours des faits vérifiables : le paiement à la livraison est
            réellement le seul mode fonctionnel aujourd'hui, le tarif de
            livraison est le vrai `delivery_fee` du vendeur (ou une mention
            honnête qu'il reste à négocier), et le contact direct n'apparaît
            que si un numéro WhatsApp est réellement renseigné. */}
        <div className="mt-4 grid grid-cols-1 gap-2 border-t border-ligne pt-4 sm:grid-cols-3">
          <TrustItem
            label="Paiement à la livraison"
            body="Commande sans créer de compte, paie en espèces à la réception."
          />
          <TrustItem label="Livraison" body={deliveryLabel(shop.delivery_fee ?? null)} />
          {shop.whatsapp_number ? (
            <TrustItem
              label="Contact direct"
              body="Une question avant de commander ? Écris sur WhatsApp."
            />
          ) : (
            <TrustItem
              label="Retours et questions"
              body="Contacte le vendeur via les coordonnées indiquées sur ta commande."
            />
          )}
        </div>
      </div>

      {/* Recherche, catégories et tri — regroupés dans une carte, même
          traitement que les filtres du dashboard vendeur (15/09/2026). */}
      <div className="mt-6 rounded-md border border-ligne bg-white p-3">
        <form method="GET" className="flex flex-wrap gap-2">
          {categorie ? <input type="hidden" name="categorie" value={categorie} /> : null}
          {tri ? <input type="hidden" name="tri" value={tri} /> : null}
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Rechercher un article dans cette boutique..."
            className="w-full flex-1 rounded-md border border-ligne bg-brume px-3 py-2 text-sm focus:border-vert-actif focus:outline-none sm:w-auto"
          />
          <button
            type="submit"
            className="shrink-0 rounded-md bg-cuivre-profond px-4 py-2 text-sm font-medium text-ivoire hover:bg-cuivre"
          >
            Rechercher
          </button>
        </form>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Link
              href={buildHref(shopSlug, current, { categorie: undefined, page: undefined })}
              style={!categorie && shop.accent_color ? { backgroundColor: shop.accent_color, borderColor: shop.accent_color } : undefined}
              className={`rounded-full border px-3 py-1 text-xs ${
                !categorie
                  ? shop.accent_color
                    ? "text-ivoire"
                    : "border-vert-sapin bg-vert-sapin text-ivoire"
                  : "border-ligne text-encre hover:border-cuivre-clair"
              }`}
            >
              Toutes catégories
            </Link>
            {availableCategories.map((c) => (
              <Link
                key={c.value}
                href={buildHref(shopSlug, current, { categorie: c.value, page: undefined })}
                style={categorie === c.value && shop.accent_color ? { backgroundColor: shop.accent_color, borderColor: shop.accent_color } : undefined}
                className={`rounded-full border px-3 py-1 text-xs ${
                  categorie === c.value
                    ? shop.accent_color
                      ? "text-ivoire"
                      : "border-vert-sapin bg-vert-sapin text-ivoire"
                    : "border-ligne text-encre hover:border-cuivre-clair"
                }`}
              >
                {c.label}
              </Link>
            ))}
          </div>

          <SortSelect
            basePath={`/${shopSlug}`}
            value={sort}
            options={SORTS as unknown as { value: string; label: string }[]}
            q={q}
            categorie={categorie}
          />
        </div>
      </div>

      {(products ?? []).length === 0 ? (
        <p className="mt-10 text-sm text-encre/70">
          {q || categorie
            ? "Aucun article ne correspond à ta recherche."
            : "Aucun produit disponible pour l'instant."}
        </p>
      ) : (
        <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {(products as PublicProduct[]).map((product) => {
            const thumbnail = [...(product.product_images ?? [])].sort(
              (a, b) => a.position - b.position
            )[0]?.url;
            // Prix effectif (soldé si une promo datée est active maintenant,
            // sinon le prix normal) — voir migration 0031 pour le contexte.
            const effective = getEffectivePrice({
              price: product.price,
              compareAtPrice: product.compare_at_price,
              salePrice: product.sale_price,
              saleStartsAt: product.sale_starts_at,
              saleEndsAt: product.sale_ends_at,
            });
            const hasDiscount =
              effective.compareAtPrice != null && effective.compareAtPrice > effective.price;
            const rating = ratingsByProduct.get(product.id) ?? null;
            return (
              <div
                key={product.id}
                className="relative rounded-md border border-ligne bg-white p-3 transition-shadow hover:shadow-md"
              >
                <div className="absolute right-2 top-2 z-10">
                  <WishlistButton
                    item={{
                      productId: product.id,
                      shopSlug,
                      productSlug: product.slug,
                      title: product.title,
                      price: effective.price,
                      compareAtPrice: effective.compareAtPrice,
                      imageUrl: thumbnail,
                    }}
                  />
                </div>
                <Link href={`/${shopSlug}/${product.slug}`} transitionTypes={["nav-forward"]}>
                  <ViewTransition name={`product-photo-${product.id}`} share="morph" default="none">
                    <ProductImage
                      src={thumbnail}
                      alt={product.title}
                      className="mb-2 aspect-square w-full rounded object-cover"
                    />
                  </ViewTransition>
                  <p className="line-clamp-2 text-sm font-medium text-encre">{product.title}</p>
                  {/* flex-wrap (15/09/2026, chantier responsive) : en grille à 2
                      colonnes sur mobile, la carte est trop étroite pour tenir
                      prix + prix barré sur une seule ligne avec des montants à
                      6 chiffres — le prix barré passe alors proprement à la
                      ligne au lieu de déborder de la carte. */}
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0 font-mono text-sm text-cuivre-profond">
                    {effective.price} FCFA
                    {hasDiscount ? (
                      <span className="font-mono text-xs text-encre/40 line-through">
                        {effective.compareAtPrice} FCFA
                      </span>
                    ) : null}
                    {effective.isOnSale ? (
                      <span className="rounded-full bg-erreur px-1.5 py-0.5 text-[10px] font-semibold text-ivoire">
                        Promo
                      </span>
                    ) : null}
                  </p>
                  {rating ? (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-encre/60">
                      <Stars rating={rating.average} />
                      <span>({rating.count})</span>
                    </p>
                  ) : null}
                  {product.category ? (
                    <p className="text-xs text-encre/50">{categoryLabel(product.category)}</p>
                  ) : null}
                </Link>
              </div>
            );
          })}
        </section>
      )}

      {totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-4 text-sm">
          {page > 1 ? (
            <Link href={buildHref(shopSlug, current, { page: String(page - 1) })} className="text-vert-actif underline">
              Page précédente
            </Link>
          ) : (
            <span className="text-encre/40">Page précédente</span>
          )}
          <span className="text-encre/70">
            Page {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={buildHref(shopSlug, current, { page: String(page + 1) })} className="text-vert-actif underline">
              Page suivante
            </Link>
          ) : (
            <span className="text-encre/40">Page suivante</span>
          )}
        </div>
      ) : null}

      <CartLink shopSlug={shopSlug} />
    </main>
    </ViewTransition>
    </ViewTransition>
  );
}

function TrustItem({ label, body }: { label: string; body: string }) {
  return (
    <div className="rounded-md bg-brume p-3">
      <p className="text-sm font-medium text-encre">{label}</p>
      <p className="mt-0.5 text-xs text-encre/70">{body}</p>
    </div>
  );
}
