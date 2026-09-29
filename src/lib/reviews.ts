import { createClient } from "@/lib/supabase/server";

// Même ordre de grandeur que le `PAGE_SIZE` des listes paginées du dashboard
// vendeur/admin (30/09/2026, audit technique — voir
// audit-technique-2026-09-29.md) : cette fonction n'affichait jamais le
// nombre exact d'avis chargés (voir borne ci-dessous), une moyenne sur un
// échantillon plafonné reste donc statistiquement représentative pour l'usage
// qui en est fait (badge de confiance), sans charger l'intégralité de
// `product_reviews` pour une boutique qui en cumule des milliers.
const RATING_SAMPLE_LIMIT = 50;

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
  // `count: "exact"` sépare le total réel (affiché) du nombre de lignes
  // effectivement chargées pour la moyenne (`RATING_SAMPLE_LIMIT`,
  // 30/09/2026) — sans ça, plafonner `.select()` aurait aussi plafonné le
  // "(X avis)" affiché à côté de la note.
  const { data, count } = await supabase
    .from("product_reviews")
    .select("rating, products!inner(shop_id)", { count: "exact" })
    .eq("products.shop_id", shopId)
    .order("created_at", { ascending: false })
    .limit(RATING_SAMPLE_LIMIT);

  const ratings = (data ?? []).map((r) => r.rating as number);
  if (ratings.length === 0) return null;

  const average = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  return { average, count: count ?? ratings.length };
}
