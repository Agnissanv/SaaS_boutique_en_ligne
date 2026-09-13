import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductList } from "./product-list";

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
//
// Rendu de la liste délégué à <ProductList> (Client Component) depuis le
// 15/09/2026 : sélection multiple + actions groupées (bulkToggleActive)
// nécessitent un état local (cases à cocher), impossible dans un Server
// Component. Cette page reste serveur pour la récupération des données.
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

      <ProductList products={(products as Product[]) ?? []} />
    </div>
  );
}
