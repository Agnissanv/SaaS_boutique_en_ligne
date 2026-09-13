import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import { CartLink } from "./cart-link";
import { SortSelect } from "@/components/sort-select";
import { Stars } from "@/components/stars";
import { getShopRating } from "@/lib/reviews";
import { WishlistButton } from "@/components/wishlist-button";

type PublicProduct = {
  id: string;
  slug: string;
  title: string;
  price: number;
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

/**
 * Page boutique publique — catalogue produits d'un vendeur.
 * Route : /[shopSlug]  (ex: /boutique-de-fatou)
 *
 * Recherche + filtre catégorie + tri ajoutés le 14/09/2026 : le cahier des
 * charges §3.1.B.2 prévoyait déjà un "catalogue des produits avec filtres
 * simples" en Priorité 1, mais ce n'était en réalité jamais construit — la
 * page n'était qu'une grille brute, contrairement à la marketplace globale
 * (src/app/page.tsx) qui avait déjà recherche + filtre catégorie. Repris ici
 * en suivant le même pattern (même construction de query, mêmes classes
 * Tailwind neutres) pour rester cohérent, avec en plus un tri par prix,
 * absent des deux pages jusqu'ici.
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
    .select("id, name, description, logo_url, cover_url")
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
    .select("id, slug, title, price, category, product_images(url, position)", {
      count: "exact",
    })
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
    <main className="mx-auto max-w-4xl px-4 py-10">
      {shop.cover_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- image uploadée par le vendeur, source dynamique
        <img
          src={shop.cover_url}
          alt=""
          className="mb-4 h-40 w-full rounded-lg object-cover"
        />
      ) : null}

      <header className="mb-8 flex items-center gap-3">
        {shop.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- image uploadée par le vendeur, source dynamique
          <img
            src={shop.logo_url}
            alt={shop.name}
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : null}
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{shop.name}</h1>
          {rating ? (
            <p className="mt-0.5 text-sm text-gray-700">
              <Stars rating={rating.average} /> {rating.average.toFixed(1)}/5 (
              {rating.count} avis)
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-gray-400">Pas encore d&apos;avis</p>
          )}
          {shop.description ? (
            <p className="mt-1 text-sm text-gray-600">{shop.description}</p>
          ) : null}
        </div>
      </header>

      <form method="GET" className="flex flex-wrap gap-2">
        {categorie ? <input type="hidden" name="categorie" value={categorie} /> : null}
        {tri ? <input type="hidden" name="tri" value={tri} /> : null}
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Rechercher un article dans cette boutique..."
          className="w-full flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm sm:w-auto"
        />
        <button
          type="submit"
          className="shrink-0 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white"
        >
          Rechercher
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Link
            href={buildHref(shopSlug, current, { categorie: undefined, page: undefined })}
            className={`rounded-full border px-3 py-1 text-xs ${
              !categorie
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-300 text-gray-700"
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
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-300 text-gray-700"
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

      {(products ?? []).length === 0 ? (
        <p className="mt-10 text-sm text-gray-600">
          {q || categorie
            ? "Aucun article ne correspond à ta recherche."
            : "Aucun produit disponible pour l'instant."}
        </p>
      ) : (
        <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {(products as PublicProduct[]).map((product) => {
            const thumbnail = [...(product.product_images ?? [])].sort(
              (a, b) => a.position - b.position
            )[0]?.url;
            return (
              <div key={product.id} className="relative rounded border border-gray-200 p-3">
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
                  {thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element -- image uploadée par le vendeur, source dynamique
                    <img
                      src={thumbnail}
                      alt={product.title}
                      className="mb-2 aspect-square w-full rounded object-cover"
                    />
                  ) : (
                    <div className="mb-2 aspect-square w-full rounded bg-gray-100" />
                  )}
                  <p className="text-sm font-medium text-gray-900">{product.title}</p>
                  <p className="text-sm text-gray-600">{product.price} FCFA</p>
                  {product.category ? (
                    <p className="text-xs text-gray-400">{categoryLabel(product.category)}</p>
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
            <Link href={buildHref(shopSlug, current, { page: String(page - 1) })} className="underline">
              Page précédente
            </Link>
          ) : (
            <span className="text-gray-400">Page précédente</span>
          )}
          <span className="text-gray-600">
            Page {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={buildHref(shopSlug, current, { page: String(page + 1) })} className="underline">
              Page suivante
            </Link>
          ) : (
            <span className="text-gray-400">Page suivante</span>
          )}
        </div>
      ) : null}

      <CartLink shopSlug={shopSlug} />
    </main>
  );
}
