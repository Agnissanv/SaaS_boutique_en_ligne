import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleShop } from "@/lib/shop-access";
import { Stars } from "@/components/stars";
import { ReviewReplyForm } from "./reply-form";

const PAGE_SIZE = 50;

type ReplyFilter = "all" | "answered" | "unanswered";

const REPLY_TABS: { value: ReplyFilter; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "unanswered", label: "Sans réponse" },
  { value: "answered", label: "Répondu" },
];

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
 *
 * Lookup passé à `getAccessibleShop` le 22/09/2026 (audit pré-lancement) :
 * cette page est visible dans la barre latérale par un collaborateur (pas
 * marquée `ownerOnly`, cohérent avec "Statistiques"), mais utilisait jusqu'ici
 * un lookup `owner_id` strict — un collaborateur cliquant "Avis" tombait dans
 * une boucle de redirections vers une page qui le renvoie elle-même vers
 * `/dashboard`, sans explication. Voir migration 0034 pour l'extension RLS/
 * RPC correspondante côté base (lecture des avis + réponse).
 *
 * **Filtre "sans réponse" + pagination ajoutés le 22/09/2026** (audit
 * "filtres partout" d'Isaac) : une boutique avec beaucoup d'avis n'avait
 * aucun moyen de retrouver ceux qui attendent encore une réponse, et la
 * liste entière se chargeait sans limite. La moyenne/le total affichés en
 * haut de page restent calculés sur TOUS les avis (requête légère séparée,
 * juste les notes) — pas seulement la page courante ou le filtre actif,
 * sinon la moyenne affichée deviendrait trompeuse.
 */
export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ reponse?: string; page?: string }>;
}) {
  const { reponse, page: pageParam } = await searchParams;
  const replyFilter: ReplyFilter =
    reponse === "answered" || reponse === "unanswered" ? reponse : "all";
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const access = user ? await getAccessibleShop(supabase, user.id) : null;

  if (!access) {
    redirect("/dashboard/boutique");
  }
  const shop = { id: access.shopId };

  let query = supabase
    .from("product_reviews")
    .select(
      "id, rating, comment, customer_name, created_at, order_id, seller_reply, seller_reply_at, products!inner(id, title, slug, shop_id)",
      { count: "exact" }
    )
    .eq("products.shop_id", shop.id);

  if (replyFilter === "answered") query = query.not("seller_reply", "is", null);
  if (replyFilter === "unanswered") query = query.is("seller_reply", null);

  const [{ data: reviews, count }, { data: allRatings }] = await Promise.all([
    query.order("created_at", { ascending: false }).range(from, to),
    supabase.from("product_reviews").select("rating, products!inner(shop_id)").eq("products.shop_id", shop.id),
  ]);

  const rows = (reviews ?? []) as unknown as Review[];
  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;
  const ratings = (allRatings ?? []) as { rating: number }[];
  const average =
    ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length : null;

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Avis clients</h1>

      {average !== null && (
        <p className="mt-2 text-sm text-encre/80">
          <Stars rating={average} /> {average.toFixed(1)}/5 ({ratings.length} avis
          au total)
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {REPLY_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value === "all" ? "/dashboard/avis" : `/dashboard/avis?reponse=${tab.value}`}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              replyFilter === tab.value
                ? "border-vert-actif bg-vert-actif/10 font-medium text-vert-sapin"
                : "border-ligne text-encre/70 hover:border-vert-actif"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-encre/70">
          {replyFilter !== "all"
            ? "Aucun avis ne correspond à ce filtre."
            : "Aucun avis pour l'instant. Les clients peuvent laisser un avis depuis la page de confirmation de leur commande, une fois livrée."}
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

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm">
          {page > 1 ? (
            <Link
              href={`/dashboard/avis?${new URLSearchParams({ ...(replyFilter !== "all" ? { reponse: replyFilter } : {}), page: String(page - 1) })}`}
              className="rounded-md border border-ligne px-3 py-1.5 text-encre transition hover:border-vert-actif"
            >
              ‹ Précédent
            </Link>
          ) : (
            <span className="rounded-md border border-ligne px-3 py-1.5 text-encre/30">‹ Précédent</span>
          )}
          <span className="px-2 font-mono text-encre/70">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={`/dashboard/avis?${new URLSearchParams({ ...(replyFilter !== "all" ? { reponse: replyFilter } : {}), page: String(page + 1) })}`}
              className="rounded-md border border-ligne px-3 py-1.5 text-encre transition hover:border-vert-actif"
            >
              Suivant ›
            </Link>
          ) : (
            <span className="rounded-md border border-ligne px-3 py-1.5 text-encre/30">Suivant ›</span>
          )}
        </div>
      )}
    </div>
  );
}
