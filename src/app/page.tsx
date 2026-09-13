import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import { SortSelect } from "@/components/sort-select";
import { WishlistButton } from "@/components/wishlist-button";

// Marketplace publique : découverte multi-boutiques (cf. demande d'Isaac du
// 13/09/2026 — équivalent d'un "atterrissage" façon Jumia, en complément du
// lien direct `/[shopSlug]` que chaque vendeur partage sur WhatsApp/Instagram).
// Le cahier des charges classe la "marketplace globale (recherche
// multi-boutiques)" en Priorité 3 (roadmap long terme) ; construite ici par
// anticipation, à la demande explicite d'Isaac plutôt que dans l'ordre du
// cahier des charges — voir decisions-techniques.md.
//
// Identité visuelle volontairement neutre (mêmes classes Tailwind gris que
// le reste de l'app) : le design définitif reste en attente avec Isaac et
// son associée (cf. decisions-techniques.md, "Ce qui n'est pas encore décidé").

const PAGE_SIZE = 24;

const SORTS = [
  { value: "recent", label: "Plus récent" },
  { value: "prix_asc", label: "Prix croissant" },
  { value: "prix_desc", label: "Prix décroissant" },
] as const;
type SortValue = (typeof SORTS)[number]["value"];

type MarketplaceProduct = {
  id: string;
  slug: string;
  title: string;
  price: number;
  category: string | null;
  product_images: { url: string; position: number }[];
  shop: { slug: string; name: string } | { slug: string; name: string }[] | null;
};

function buildHref(
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
  return qs ? `/?${qs}` : "/";
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categorie?: string; tri?: string; page?: string }>;
}) {
  const { q, categorie, tri, page: pageParam } = await searchParams;
  const sort: SortValue = SORTS.some((s) => s.value === tri) ? (tri as SortValue) : "recent";
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  let query = supabase
    .from("products")
    .select(
      "id, slug, title, price, category, product_images(url, position), shop:shops!inner(slug, name, status)",
      { count: "exact" }
    )
    .eq("is_active", true)
    .is("deleted_at", null)
    .eq("shop.status", "active")
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
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-gray-900">
          Trouve ton prochain achat
        </h1>
        <div className="flex shrink-0 items-center gap-4">
          <Link href="/favoris" className="text-sm font-medium text-gray-700 underline">
            Mes favoris
          </Link>
          <Link href="/compte" className="text-sm font-medium text-gray-700 underline">
            Mon compte
          </Link>
          <Link
            href="/inscription"
            className="text-sm font-medium text-gray-700 underline"
          >
            Vendre sur la plateforme
          </Link>
        </div>
      </div>
      <p className="mt-1 text-sm text-gray-600">
        Le catalogue de tous les vendeurs de la plateforme, au même endroit.
      </p>

      <form method="GET" action="/" className="mt-6 flex gap-2">
        {categorie ? (
          <input type="hidden" name="categorie" value={categorie} />
        ) : null}
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Rechercher un article..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
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
            href={buildHref(current, { categorie: undefined, page: undefined })}
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
              href={buildHref(current, { categorie: c.value, page: undefined })}
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
          basePath="/"
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
            : "Aucun article disponible pour l'instant — reviens bientôt."}
        </p>
      ) : (
        <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {(products as MarketplaceProduct[]).map((product) => {
            const shop = Array.isArray(product.shop) ? product.shop[0] : product.shop;
            const thumbnail = [...(product.product_images ?? [])].sort(
              (a, b) => a.position - b.position
            )[0]?.url;
            if (!shop) return null;
            return (
              <div key={product.id} className="relative rounded border border-gray-200 p-3">
                <div className="absolute right-2 top-2 z-10">
                  <WishlistButton
                    item={{
                      productId: product.id,
                      shopSlug: shop.slug,
                      productSlug: product.slug,
                      title: product.title,
                      price: product.price,
                      imageUrl: thumbnail,
                    }}
                  />
                </div>
                <Link href={`/${shop.slug}/${product.slug}`}>
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
                  <p className="mt-1 truncate text-xs text-gray-500">{shop.name}</p>
                  {product.category ? (
                    <p className="text-xs text-gray-400">
                      {categoryLabel(product.category)}
                    </p>
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
            <Link
              href={buildHref(current, { page: String(page - 1) })}
              className="underline"
            >
              Page précédente
            </Link>
          ) : (
            <span className="text-gray-400">Page précédente</span>
          )}
          <span className="text-gray-600">
            Page {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={buildHref(current, { page: String(page + 1) })}
              className="underline"
            >
              Page suivante
            </Link>
          ) : (
            <span className="text-gray-400">Page suivante</span>
          )}
        </div>
      ) : null}
    </main>
  );
}
