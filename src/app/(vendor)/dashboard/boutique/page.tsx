import { createClient } from "@/lib/supabase/server";
import { ShopForm } from "./shop-form";

// Réglages boutique : nom, description, catégorie, logo, couverture, lien
// public (slug). cf. cahier des charges §3.1.A.2.
//
// Upload logo/couverture : reporté à un prochain passage (Supabase Storage +
// bucket public "shop-assets"), pas nécessaire pour créer une boutique
// fonctionnelle. Un vendeur peut créer sa boutique et vendre sans logo.
export default async function ShopSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: shop } = await supabase
    .from("shops")
    .select("id, name, slug, description, category, logo_url, cover_url")
    .eq("owner_id", user?.id ?? "")
    .maybeSingle();

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900">Ma boutique</h1>
      <p className="mt-2 text-sm text-gray-600">
        {shop
          ? "Modifie les informations de ta boutique."
          : "Crée ta boutique pour commencer à ajouter des produits."}
      </p>
      <ShopForm shop={shop ?? null} />
    </div>
  );
}
