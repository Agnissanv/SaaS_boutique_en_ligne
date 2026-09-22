import { notFound, redirect } from "next/navigation";
import { ViewTransition } from "react";
import { createClient } from "@/lib/supabase/server";
import { getShopSubscription } from "@/lib/subscription";
import { getAccessibleShop } from "@/lib/shop-access";
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

  // Accessible à un collaborateur actif (plan Pro), pas seulement au
  // propriétaire — voir src/lib/shop-access.ts.
  const access = user ? await getAccessibleShop(supabase, user.id) : null;

  if (!access) {
    redirect("/dashboard/boutique");
  }
  const shop = { id: access.shopId };

  const { data: product } = await supabase
    .from("products")
    .select(
      "id, title, description, category, price, compare_at_price, stock, shop_id, deleted_at, tags, stock_alert_threshold, highlights, attributes, sku, barcode, sale_price, sale_starts_at, sale_ends_at"
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
    .select("name, value, sku, barcode")
    .eq("product_id", productId);

  const { data: images } = await supabase
    .from("product_images")
    .select("url")
    .eq("product_id", productId)
    .order("position", { ascending: true });

  // Plan Starter : stock/variantes masqués (spec du 15/09/2026) — voir
  // ProductForm et produits/actions.ts pour l'application complète.
  const subscription = await getShopSubscription(supabase, shop.id);

  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
    <ViewTransition enter="kv-content-in" default="none">
    <div>
      <h1 className="text-lg font-semibold text-encre">
        Modifier « {product.title} »
      </h1>
      <ProductForm
        product={product}
        variants={variants ?? []}
        images={(images ?? []).map((img) => img.url)}
        canManageStock={subscription.features.canManageStock}
        canUseVariants={subscription.features.canUseVariants}
        canUseAdvancedStockAlerts={subscription.features.hasAdvancedStockAlerts}
      />
    </div>
    </ViewTransition>
    </ViewTransition>
  );
}
