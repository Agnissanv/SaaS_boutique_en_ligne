import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Suggestions de recherche marketplace (autocomplete) — ajouté le 21/09/2026,
 * item du "plus tard" du cahier des charges le plus autonome à construire
 * pendant la pause CinetPay (ne dépend d'aucun paiement).
 *
 * Répond à la fois avec des produits (titre) ET des boutiques (nom) — ce qui
 * règle au passage un point resté "pas encore décidé" dans
 * decisions-techniques.md ("si la recherche marketplace doit un jour couvrir
 * le nom de la boutique") : la recherche texte classique reste limitée au
 * titre produit (changement plus risqué, hors périmètre ici), mais
 * l'autocomplete peut sans risque proposer directement une boutique dont le
 * nom correspond, en plus des produits.
 *
 * Route publique (client anonyme, mêmes policies RLS que la page d'accueil
 * marketplace) — pas d'authentification requise, cohérent avec le fait que
 * la marketplace elle-même est publique.
 */

const MIN_QUERY_LENGTH = 2;
const PRODUCT_SUGGESTIONS_LIMIT = 6;
const SHOP_SUGGESTIONS_LIMIT = 3;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ products: [], shops: [] });
  }

  const supabase = await createClient();

  const [productsResult, shopsResult] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, slug, title, price, product_images(url, position), shop:shops!inner(slug, status)"
      )
      .eq("is_active", true)
      .is("deleted_at", null)
      .eq("shop.status", "active")
      .ilike("title", `%${q}%`)
      .limit(PRODUCT_SUGGESTIONS_LIMIT),
    supabase
      .from("shops")
      .select("slug, name")
      .eq("status", "active")
      .ilike("name", `%${q}%`)
      .limit(SHOP_SUGGESTIONS_LIMIT),
  ]);

  type RawProduct = {
    id: string;
    slug: string;
    title: string;
    price: number;
    product_images: { url: string; position: number }[];
    shop: { slug: string; status: string } | { slug: string; status: string }[] | null;
  };

  const products = ((productsResult.data as RawProduct[] | null) ?? [])
    .map((product) => {
      const shop = Array.isArray(product.shop) ? product.shop[0] : product.shop;
      if (!shop) return null;
      const thumbnail = [...(product.product_images ?? [])].sort(
        (a, b) => a.position - b.position
      )[0]?.url;
      return {
        id: product.id,
        slug: product.slug,
        shopSlug: shop.slug,
        title: product.title,
        price: product.price,
        thumbnail,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const shops = (shopsResult.data ?? []).map((shop) => ({
    slug: shop.slug,
    name: shop.name,
  }));

  return NextResponse.json({ products, shops });
}
