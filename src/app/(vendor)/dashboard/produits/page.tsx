import { createClient } from "@/lib/supabase/server";

// Gestion des produits du vendeur connecté (ajout, modif, suppression, stock).
// cf. cahier des charges §3.1.A.3.
export default async function ProductsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: products } = await supabase
    .from("products")
    .select("*, shops!inner(owner_id)")
    .eq("shops.owner_id", user?.id ?? "");

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900">Mes produits</h1>
      <ul className="mt-4 divide-y divide-gray-200">
        {(products ?? []).map((product: { id: string; title: string; stock: number }) => (
          <li key={product.id} className="py-2 text-sm text-gray-700">
            {product.title} — stock : {product.stock}
          </li>
        ))}
      </ul>
      {/* TODO: formulaire d'ajout/édition produit (titre, prix, photos, variantes) */}
    </div>
  );
}
