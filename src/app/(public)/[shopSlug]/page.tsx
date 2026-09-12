import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
    .select("*, products(*)")
    .eq("slug", shopSlug)
    .eq("status", "active")
    .maybeSingle();

  if (!shop) notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900">{shop.name}</h1>
        {shop.description ? (
          <p className="mt-1 text-sm text-gray-600">{shop.description}</p>
        ) : null}
      </header>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {(shop.products ?? []).map((product: { id: string; title: string; price: number }) => (
          <article key={product.id} className="rounded border border-gray-200 p-3">
            <p className="text-sm font-medium text-gray-900">{product.title}</p>
            <p className="text-sm text-gray-600">{product.price} FCFA</p>
          </article>
        ))}
      </section>
    </main>
  );
}
