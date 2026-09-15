import { createClient } from "@/lib/supabase/server";
import { ShopForm } from "./shop-form";

// Réglages boutique : nom, description, catégorie, logo, couverture, lien
// public (slug). cf. cahier des charges §3.1.A.2.
//
// Upload logo/couverture : implémenté (Supabase Storage, bucket public
// "shop-assets" — voir ImageField dans shop-form.tsx). Reste optionnel :
// un vendeur peut créer sa boutique et vendre sans logo.
export default async function ShopSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: shop } = await supabase
    .from("shops")
    .select(
      "id, name, slug, description, category, logo_url, cover_url, delivery_fee, whatsapp_number, notification_email"
    )
    .eq("owner_id", user?.id ?? "")
    .maybeSingle();

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Ma boutique</h1>
      <p className="mt-2 text-sm text-encre/70">
        {shop
          ? "Modifie les informations de ta boutique."
          : "Crée ta boutique pour commencer à ajouter des produits."}
      </p>
      <ShopForm shop={shop ?? null} />
    </div>
  );
}
