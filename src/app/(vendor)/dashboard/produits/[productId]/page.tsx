import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "../product-form";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
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

  const { data: product } = await supabase
    .from("products")
    .select(
      "id, title, description, category, price, compare_at_price, stock, shop_id, deleted_at"
    )
    .eq("id", productId)
    .eq("shop_id", shop.id)
    .maybeSingle();

  // Introuvable, appartient à une autre boutique, ou déjà supprimé.
  if (!product || product.deleted_at) {
    notFound();
  }

  const { data: variants } = await supabase
    .from("product_variants")
    .select("name, value")
    .eq("product_id", productId);

  const { data: images } = await supabase
    .from("product_images")
    .select("url")
    .eq("product_id", productId)
    .order("position", { ascending: true });

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900">
        Modifier « {product.title} »
      </h1>
      <ProductForm
        product={product}
        variants={variants ?? []}
        images={(images ?? []).map((img) => img.url)}
      />
    </div>
  );
}
