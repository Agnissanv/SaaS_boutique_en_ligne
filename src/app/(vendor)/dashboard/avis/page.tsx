import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Stars } from "@/components/stars";
import { ReviewReplyForm } from "./reply-form";

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  customer_name: string;
  created_at: string;
  order_id: string | null;
  seller_reply: string | null;
  seller_reply_at: string | null;
  products: { id: string; title: string; slug: string } | { id: string; title: string; slug: string }[] | null;
};

/** Même badge que sur la fiche produit publique — voir sa doc là-bas. */
function VerifiedPurchaseBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-succes/15 px-2 py-0.5 text-[11px] font-medium text-succes">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
        <circle cx="10" cy="10" r="7" />
        <path d="M7 10.2l2 2 4-4.4" />
      </svg>
      Achat vérifié
    </span>
  );
}

/**
 * Page "Avis" — créée le 15/09/2026, manque identifié dans l'analyse du
 * dashboard vendeur : les avis existaient déjà par produit côté public
 * (migration 0011) mais le vendeur n'avait AUCUNE vue consolidée des siens,
 * il devait aller regarder chaque fiche produit une par une.
 *
 * Rendue possible par la nouvelle policy `product_reviews_owner_read`
 * (migration 0013) : sans elle, un produit désactivé aurait masqué ses avis
 * même à son propriétaire (la policy publique exige produit + boutique
 * actifs).
 *
 * Le vendeur ne peut toujours pas modifier l'avis lui-même (note, commentaire,
 * nom du client — cf. 0011 "avis non modifiable par le vendeur"), mais peut
 * depuis le 21/09/2026 y répondre publiquement (voir migration 0028,
 * `reply-form.tsx`) : une réponse vendeur, séparée de l'avis, qui s'affiche
 * aussi sur la fiche produit publique.
 */
export default async function ReviewsPage() {
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

  const { data: reviews } = await supabase
    .from("product_reviews")
    .select(
      "id, rating, comment, customer_name, created_at, order_id, seller_reply, seller_reply_at, products!inner(id, title, slug, shop_id)"
    )
    .eq("products.shop_id", shop.id)
    .order("created_at", { ascending: false });

  const rows = (reviews ?? []) as unknown as Review[];
  const average =
    rows.length > 0 ? rows.reduce((sum, r) => sum + r.rating, 0) / rows.length : null;

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Avis clients</h1>

      {average !== null && (
        <p className="mt-2 text-sm text-encre/80">
          <Stars rating={average} /> {average.toFixed(1)}/5 ({rows.length} avis
          au total)
        </p>
      )}

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-encre/70">
          Aucun avis pour l&apos;instant. Les clients peuvent laisser un avis
          depuis la page de confirmation de leur commande, une fois livrée.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-ligne">
          {rows.map((review) => {
            const product = Array.isArray(review.products)
              ? review.products[0]
              : review.products;
            return (
              <li key={review.id} className="py-3">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-encre">
                  <span><Stars rating={review.rating} /> — {review.customer_name}</span>
                  {review.order_id ? <VerifiedPurchaseBadge /> : null}
                </p>
                {product && (
                  <Link
                    href={`/dashboard/produits/${product.id}`}
                    className="text-xs text-encre/60 underline hover:text-vert-sapin"
                  >
                    {product.title}
                  </Link>
                )}
                {review.comment && (
                  <p className="mt-1 text-sm text-encre/80">{review.comment}</p>
                )}
                <p className="mt-1 text-xs text-encre/50">
                  {new Date(review.created_at).toLocaleDateString("fr-FR")}
                </p>
                <ReviewReplyForm
                  key={review.seller_reply_at ?? "none"}
                  reviewId={review.id}
                  initialReply={review.seller_reply}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
