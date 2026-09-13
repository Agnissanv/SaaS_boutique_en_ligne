import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toggleProductActive, deleteProduct } from "./actions";

type Product = {
  id: string;
  title: string;
  price: number;
  stock: number;
  is_active: boolean;
  product_images: { url: string; position: number }[];
};

// Gestion des produits du vendeur connecté (ajout, modif, suppression, stock).
// cf. cahier des charges §3.1.A.3.
export default async function ProductsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .eq("owner_id", user?.id ?? "")
    .maybeSingle();

  if (!shop) {
    redirect("/dashboard/boutique");
  }

  const { data: products } = await supabase
    .from("products")
    .select("id, title, price, stock, is_active, product_images(url, position)")
    .eq("shop_id", shop.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Mes produits</h1>
        <Link
          href="/dashboard/produits/nouveau"
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white"
        >
          Ajouter un produit
        </Link>
      </div>

      {(products ?? []).length === 0 ? (
        <p className="mt-4 text-sm text-gray-600">
          Aucun produit pour l&apos;instant. Ajoute ton premier produit pour
          qu&apos;il apparaisse sur ta boutique.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-200">
          {(products as Product[]).map((product) => {
            const thumbnail = [...(product.product_images ?? [])].sort(
              (a, b) => a.position - b.position
            )[0]?.url;
            return (
            <li
              key={product.id}
              className="flex items-center justify-between gap-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                {thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element -- image uploadée par le vendeur, source dynamique
                  <img
                    src={thumbnail}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded bg-gray-100" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {product.title}
                    {!product.is_active && (
                      <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                        désactivé
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-600">
                    {product.price} FCFA — stock : {product.stock}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/dashboard/produits/${product.id}`}
                  className="text-sm text-gray-700 underline"
                >
                  Modifier
                </Link>
                <form
                  action={toggleProductActive.bind(
                    null,
                    product.id,
                    !product.is_active
                  )}
                >
                  <button type="submit" className="text-sm text-gray-700 underline">
                    {product.is_active ? "Désactiver" : "Activer"}
                  </button>
                </form>
                <form action={deleteProduct.bind(null, product.id)}>
                  <button type="submit" className="text-sm text-red-600 underline">
                    Supprimer
                  </button>
                </form>
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
