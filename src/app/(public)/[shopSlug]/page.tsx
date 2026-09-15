import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import { CartLink } from "./cart-link";
import { SortSelect } from "@/components/sort-select";
import { Stars } from "@/components/stars";
import { getShopRating } from "@/lib/reviews";
import { WishlistButton } from "@/components/wishlist-button";
import { WhatsappContactButton } from "@/components/whatsapp-contact-button";
import { ProductImage } from "@/components/product-image";

type PublicProduct = {
  id: string;
  slug: string;
  title: string;
  price: number;
  compare_at_price: number | null;
  category: string | null;
  product_images: { url: string; position: number }[];
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

  const supabase = await createClient();

  const { data: shop } = await supabase
    .from("shops")
    .select("id, name, description, logo_url, cover_url, whatsapp_number, delivery_fee")
    .eq("slug", shopSlug)
    .eq("status", "active")
    .maybeSingle();

  if (!shop) notFound();

  const rating = await getShopRating(supabase, shop.id);

  // Compteur de vues (cf. cahier des charges §3.1.A.4) : simple incrément,
  // pas de déduplication par visiteur — voir 0005_shop_stats.sql. On ignore
  // volontairement une éventuelle erreur : ça ne doit jamais empêcher
  // l'affichage de la boutique.
  await supabase.rpc("increment_shop_view", { p_shop_slug: shopSlug });

  let query = supabase
    .from("products")
    .select(
      "id, slug, title, price, compare_at_price, category, product_images(url, position)",
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

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;
  const current = { q, categorie, tri, page: pageParam };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="mb-3 flex justify-end">
        <Link href="/compte" className="text-xs text-vert-actif underline">
          Mon compte
        </Link>
      </div>

      {/* Bannière — image de couverture du vendeur si renseignée, sinon un
          fond vert profond neutre plutôt qu'un blanc vide. */}
      <div className="overflow-hidden rounded-xl">
        {shop.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- image uploadée par le vendeur, source dynamique
          <img
            src={shop.cover_url}
            alt=""
            className="h-40 w-full object-cover sm:h-56"
          />
        ) : (
          <div className="h-24 w-full bg-vert-profond sm:h-32" />
        )}
      </div>

      {/* Carte d'identité — chevauche légèrement la bannière (repère visuel
          de boutique en ligne, comme une page vendeur Jumia/Etsy) et
          regroupe logo, note de confiance mise en avant, description,
          contact direct et le bloc de confiance. */}
      <div className="relative z-10 -mt-8 rounded-xl border border-ligne bg-white p-4 shadow-sm sm:-mt-12 sm:p-6">
        <div className="flex flex-wrap items-start gap-4">
          {shop.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- image uploadée par le vendeur, source dynamique
            <img
              src={shop.logo_url}
              alt={shop.name}
              className="h-16 w-16 shrink-0 rounded-full border-4 border-white object-cover shadow sm:h-20 sm:w-20"
            />
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
              className={`rounded-full border px-3 py-1 text-xs ${
                !categorie
                  ? "border-vert-sapin bg-vert-sapin text-ivoire"
                  : "border-ligne text-encre hover:border-cuivre-clair"
              }`}
            >
              Toutes catégories
            </Link>
            {CATEGORIES.map((c) => (
              <Link
                key={c.value}
                href={buildHref(shopSlug, current, { categorie: c.value, page: undefined })}
                className={`rounded-full border px-3 py-1 text-xs ${
                  categorie === c.value
                    ? "border-vert-sapin bg-vert-sapin text-ivoire"
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
            const hasDiscount =
              product.compare_at_price != null && product.compare_at_price > product.price;
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
                      price: product.price,
                      imageUrl: thumbnail,
                    }}
                  />
                </div>
                <Link href={`/${shopSlug}/${product.slug}`}>
                  <ProductImage
                    src={thumbnail}
                    alt={product.title}
                    className="mb-2 aspect-square w-full rounded object-cover"
                  />
                  <p className="line-clamp-2 text-sm font-medium text-encre">{product.title}</p>
                  {/* flex-wrap (15/09/2026, chantier responsive) : en grille à 2
                      colonnes sur mobile, la carte est trop étroite pour tenir
                      prix + prix barré sur une seule ligne avec des montants à
                      6 chiffres — le prix barré passe alors proprement à la
                      ligne au lieu de déborder de la carte. */}
                  <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0 font-mono text-sm text-cuivre-profond">
                    {product.price} FCFA
                    {hasDiscount ? (
                      <span className="font-mono text-xs text-encre/40 line-through">
                        {product.compare_at_price} FCFA
                      </span>
                    ) : null}
                  </p>
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
