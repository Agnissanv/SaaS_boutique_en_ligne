import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CartLink } from "./cart-link";

type PublicProduct = {
  id: string;
  slug: string;
  title: string;
  price: number;
  product_images: { url: string; position: number }[];
};

/**
 * Page boutique publique — catalogue produits d'un vendeur.
 * Route : /[shopSlug]  (ex: /boutique-de-fatou)
 */
export default async function ShopPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>;
}) {
  const { shopSlug } = await params;
  const supabase = await createClient();

  const { data: shop } = await supabase
    .from("shops")
    .select("*, products(*, product_images(url, position))")
    .eq("slug", shopSlug)
    .eq("status", "active")
    // Filtre sur la table imbriquée : ne renvoie que les produits actifs et
    // non supprimés, sans exclure la boutique si elle n'en a aucun.
    .eq("products.is_active", true)
    .is("products.deleted_at", null)
    .maybeSingle();

  if (!shop) notFound();

  // Compteur de vues (cf. cahier des charges §3.1.A.4) : simple incrément,
  // pas de déduplication par visiteur — voir 0005_shop_stats.sql. On ignore
  // volontairement une éventuelle erreur : ça ne doit jamais empêcher
  // l'affichage de la boutique.
  await supabase.rpc("increment_shop_view", { p_shop_slug: shopSlug });

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
          {shop.description ? (
            <p className="mt-1 text-sm text-gray-600">{shop.description}</p>
          ) : null}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {((shop.products ?? []) as PublicProduct[]).map((product) => {
          const thumbnail = [...(product.product_images ?? [])].sort(
            (a, b) => a.position - b.position
          )[0]?.url;
          return (
            <Link
              key={product.id}
              href={`/${shopSlug}/${product.slug}`}
              className="rounded border border-gray-200 p-3"
            >
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
            </Link>
          );
        })}
      </section>

      <CartLink shopSlug={shopSlug} />
    </main>
  );
}
