import { createClient } from "@/lib/supabase/server";

/**
 * Note de confiance au niveau boutique — demandée par Isaac le 14/09/2026
 * suite à l'analyse comparative avec Jumia : les avis existaient déjà par
 * produit (migration 0011) mais rien n'agrégeait une réputation globale du
 * vendeur, alors que c'est justement le signal de confiance principal sur un
 * marketplace multi-vendeurs (plus qu'un avis isolé sur un seul produit).
 *
 * Pas de nouvelle table/colonne : simple agrégation à la volée sur
 * `product_reviews` jointe à `products` (même RLS que la lecture d'avis par
 * produit, qui autorise déjà la lecture publique des avis d'un produit actif
 * — aucune policy supplémentaire nécessaire).
 */
export async function getShopRating(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shopId: string
): Promise<{ average: number; count: number } | null> {
  const { data } = await supabase
    .from("product_reviews")
    .select("rating, products!inner(shop_id)")
    .eq("products.shop_id", shopId);

  const ratings = (data ?? []).map((r) => r.rating as number);
  if (ratings.length === 0) return null;

  const average = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  return { average, count: ratings.length };
}
