import type { Metadata } from "next";
import { fcfa } from "@/lib/utils/money";
import { CheckoutSteps } from "@/components/checkout-steps";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ReviewForm } from "./review-form";
import { CancelOrderButton } from "./cancel-order-button";
import { ORDER_STATUS_BADGE_CLASS, ORDER_STATUS_LABELS } from "@/lib/orders";
import { ProductImage } from "@/components/product-image";
import { WhatsappContactButton } from "@/components/whatsapp-contact-button";
import { InstallInvite } from "@/components/install-invite";

const PAYMENT_LABELS: Record<string, string> = {
  cash_on_delivery: "Paiement à la livraison",
  mobile_money: "Mobile Money",
};

// Statuts pour lesquels l'annulation a un sens — voir cancel_order
// (migration 0030) qui applique la même règle côté serveur.
const CANCELLABLE_STATUSES = ["pending", "paid", "preparing"];

// Titre d'onglet + jamais indexée (page personnelle, déjà exclue dans
// robots.ts — doublé ici pour les liens partagés, 13/10/2026).
export const metadata: Metadata = {
  title: "Ta commande — KEVA",
  robots: { index: false, follow: false },
};

const ORDER_DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Abidjan",
});

type ReceiptItem = {
  product_id: string;
  product_title: string;
  variant_label: string | null;
  quantity: number;
  unit_price: number;
};

/**
 * Confirmation de commande + reçu (cahier des charges §3.1.B.6).
 * Route : /[shopSlug]/commande/[orderId]
 *
 * Accessible sans compte via l'id (UUID non devinable) de la commande, tout
 * juste créée par create_order — voir 0004_orders_rpc.sql pour le choix
 * d'exposer ça via des fonctions RPC plutôt qu'une policy RLS large.
 *
 * Recolorée en charte KEVA le 15/09/2026 (côté client) — pure recolor. Le
 * dictionnaire de statuts local dupliqué a été retiré au profit du module
 * partagé `src/lib/orders.ts` (déjà utilisé par le dashboard vendeur et par
 * /compte) ; le statut s'affiche désormais en badge coloré.
 *
 * 21/09/2026 (demande d'Isaac) — trois ajouts :
 *  - Annulation client (CancelOrderButton), visible seulement pour les
 *    statuts encore annulables.
 *  - Avis client repoussé à after-livraison uniquement ("un client n'a pas
 *    le droit de mettre son avis... alors qu'il n'a pas encore touché le
 *    produit") — submit_product_review le refuse aussi côté serveur.
 *  - Bannière de création de compte pour les visiteurs non connectés
 *    ("juste après avoir passé à l'achat, on lui propose de créer un
 *    compte pour avoir un meilleur suivi") — pré-remplit nom/téléphone via
 *    des query params repris par le formulaire d'inscription client.
 *
 * Refaite le 13/10/2026 (lot 4 UX, pages publiques) : c'est l'écran qui doit
 * rassurer le client juste après l'achat, il n'affichait qu'un titre et des
 * lignes de texte. Désormais : en-tête de réussite (ou d'annulation /
 * livraison selon le statut), bloc « Et maintenant ? » qui explique la suite
 * (le vendeur appelle, livraison, paiement à la réception), bouton WhatsApp
 * vers le vendeur avec un message pré-rempli (nom, articles, total — le
 * vendeur ne voit pas d'identifiant de commande dans son tableau de bord,
 * inutile d'en citer un), et récapitulatif en carte avec la photo des
 * articles.
 */
export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ shopSlug: string; orderId: string }>;
}) {
  const { shopSlug, orderId } = await params;
  const supabase = await createClient();

  const { data: orders } = await supabase.rpc("get_order_receipt", {
    p_order_id: orderId,
  });
  const order = orders?.[0];

  if (!order || order.shop_slug !== shopSlug) notFound();

  const { data: items } = await supabase.rpc("get_order_receipt_items", {
    p_order_id: orderId,
  });

  // Avis déjà laissés pour cette commande — ajouté le 22/09/2026 (audit
  // pré-lancement) : `submit_product_review` fait un upsert exprès ("le
  // client peut revenir corriger son avis", migration 0011), mais le
  // formulaire repartait toujours vierge, sans indiquer qu'un avis existait
  // déjà. Un client revenant sur cette page après avoir déjà noté un produit
  // pouvait donc écraser sans le savoir sa note/commentaire par du vide.
  // Lecture via la policy publique `product_reviews_public_read` (aucun
  // compte requis ici) ; si le produit a été désactivé depuis, la requête ne
  // renverra rien et le formulaire s'affiche simplement vierge comme avant.
  const { data: existingReviews } = await supabase
    .from("product_reviews")
    .select("product_id, rating, comment")
    .eq("order_id", orderId);
  const reviewsByProduct = new Map(
    (existingReviews ?? []).map((r) => [r.product_id, r])
  );

  const receiptItems = (items ?? []) as ReceiptItem[];
  const productIds = Array.from(new Set(receiptItems.map((item) => item.product_id)));

  // Numéro WhatsApp de la boutique + photo de chaque article (13/10/2026) —
  // lecture publique ; un produit désactivé depuis s'affiche sans photo.
  const [{ data: shop }, { data: products }] = await Promise.all([
    supabase.from("shops").select("whatsapp_number, delivery_fee").eq("slug", shopSlug).maybeSingle(),
    supabase
      .from("products")
      .select("id, product_images(url, position)")
      .in("id", productIds.length > 0 ? productIds : ["00000000-0000-0000-0000-000000000000"]),
  ]);
  const imageByProduct = new Map(
    (products ?? []).map((product) => [
      product.id,
      [...(product.product_images ?? [])].sort((a, b) => a.position - b.position)[0]?.url,
    ])
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isCancelled = order.status === "cancelled";
  const isDelivered = order.status === "delivered";
  const isActive = CANCELLABLE_STATUSES.includes(order.status);
  const firstName = order.customer_name.trim().split(/\s+/)[0] || order.customer_name;
  const deliveryFee = Number(order.delivery_fee);
  const itemsTotal = receiptItems.reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0);
  // Réduction d'un code promo : absente du reçu (get_order_receipt), déduite
  // de l'écart entre les articles et le total hors livraison.
  const discount = Math.max(0, Math.round(itemsTotal - (Number(order.total_amount) - deliveryFee)));
  // Frais à 0 : livraison gratuite si la boutique l'a fixée à 0, sinon frais
  // non renseignés (create_order fait un coalesce à 0) -> à voir avec le vendeur.
  const deliveryFeeUnknown =
    deliveryFee === 0 && (shop?.delivery_fee == null || Number(shop.delivery_fee) !== 0);

  const whatsappMessage = [
    `Bonjour, c'est ${order.customer_name}. Je viens de passer une commande sur KEVA :`,
    ...receiptItems.map(
      (item) =>
        `- ${item.product_title}${item.variant_label ? ` (${item.variant_label})` : ""} × ${item.quantity}`
    ),
    `Total : ${fcfa(order.total_amount)}`,
  ].join("\n");

  return (
    <main className="w-full mx-auto max-w-xl px-4 py-8 sm:py-10">
      {/* Invitation à installer KEVA juste après l'achat (13/10/2026). */}
      {!isCancelled && <InstallInvite context="order" delayMs={4000} />}
      <div className="mb-8">
        <CheckoutSteps current={3} />
      </div>

      {/* En-tête : réussite, livraison ou annulation selon le statut. */}
      <section className="text-center">
        <span
          aria-hidden="true"
          className={`kv-pop mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
            isCancelled ? "bg-brume text-encre/60" : "bg-vert-actif text-ivoire shadow-lg shadow-vert-actif/25"
          }`}
        >
          {isCancelled ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="h-7 w-7">
              <path d="M7 7l10 10M17 7 7 17" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
              <path d="m5.5 12.5 4.2 4.2L18.5 8" />
            </svg>
          )}
        </span>
        <h1 className="mt-5 font-display text-2xl font-bold text-encre">
          {isCancelled ? "Commande annulée" : isDelivered ? "Commande livrée" : "Commande confirmée"}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-encre/70">
          {isCancelled ? (
            <>Cette commande chez {order.shop_name} a été annulée. Tu peux repasser commande quand tu veux.</>
          ) : isDelivered ? (
            <>Merci {firstName} pour ton achat chez {order.shop_name}. Dis-nous ce que tu en as pensé plus bas.</>
          ) : (
            <>
              Merci {firstName} ! Ta commande chez{" "}
              <span className="font-semibold text-encre">{order.shop_name}</span> a bien été enregistrée.
            </>
          )}
        </p>
        <p className="mt-2 text-xs text-encre/60">
          Passée le {ORDER_DATE_FORMAT.format(new Date(order.created_at))}
        </p>
      </section>

      {/* La suite, en clair : la question n°1 du client juste après l'achat. */}
      {isActive && (
        <section className="mt-8 rounded-2xl border border-ligne bg-white p-5">
          <h2 className="font-display text-base font-semibold text-encre">Et maintenant ?</h2>
          <ol className="mt-4 space-y-4">
            <NextStep index={1} title={`${order.shop_name} prépare ta commande`}>
              Le vendeur va te contacter au{" "}
              <span className="whitespace-nowrap font-semibold text-encre">{order.customer_phone}</span> pour
              convenir de la livraison. Garde ton téléphone à portée de main.
            </NextStep>
            <NextStep index={2} title="Livraison">
              {order.delivery_address ? (
                <>À l&apos;adresse indiquée : {order.delivery_address}.</>
              ) : (
                <>Le lieu et l&apos;heure de livraison se fixent avec le vendeur.</>
              )}
            </NextStep>
            <NextStep index={3} title={PAYMENT_LABELS[order.payment_method] ?? "Paiement"}>
              {order.payment_method === "cash_on_delivery" ? (
                <>
                  Tu paies <span className="font-semibold text-encre">{fcfa(order.total_amount)}</span>
                  {deliveryFeeUnknown ? " (plus la livraison, à voir avec le vendeur)" : ""} en espèces à la
                  réception, rien avant.
                </>
              ) : (
                <>Le paiement se règle directement avec le vendeur.</>
              )}
            </NextStep>
          </ol>
          {shop?.whatsapp_number ? (
            <div className="mt-5">
              <WhatsappContactButton
                whatsappNumber={shop.whatsapp_number}
                message={whatsappMessage}
                label="Écrire au vendeur sur WhatsApp"
                variant="outline"
              />
            </div>
          ) : null}
        </section>
      )}

      {!user && !isCancelled && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-vert-actif/25 bg-vert-actif/5 p-4">
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-vert-actif">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5 19.5a7 7 0 0 1 14 0" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-encre">Suis tes commandes facilement</p>
            <p className="mt-0.5 text-sm text-encre/70">
              Crée ton compte pour retrouver toutes tes commandes au même endroit, chez n&apos;importe quel vendeur KEVA.
            </p>
            <Link
              href={`/compte/inscription?name=${encodeURIComponent(order.customer_name)}&phone=${encodeURIComponent(order.customer_phone)}`}
              className="mt-3 inline-flex rounded-full bg-vert-actif px-4 py-2 text-sm font-semibold text-ivoire transition hover:bg-vert-sapin"
            >
              Créer mon compte
            </Link>
          </div>
        </div>
      )}

      {/* Récapitulatif */}
      <section className="mt-6 overflow-hidden rounded-2xl border border-ligne bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-ligne px-5 py-3.5">
          <h2 className="font-display text-base font-semibold text-encre">Récapitulatif</h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              ORDER_STATUS_BADGE_CLASS[order.status] ?? "bg-brume text-encre/70"
            }`}
          >
            {ORDER_STATUS_LABELS[order.status] ?? order.status}
          </span>
        </div>

        <ul className="divide-y divide-ligne">
          {receiptItems.map((item, index) => (
            <li key={index} className="flex items-center gap-3 px-5 py-3">
              <ProductImage
                src={imageByProduct.get(item.product_id)}
                alt=""
                className="h-14 w-14 shrink-0 rounded-lg border border-ligne/70 object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium leading-snug text-encre">{item.product_title}</p>
                <p className="mt-0.5 text-xs text-encre/70">
                  {item.variant_label ? `${item.variant_label} · ` : ""}
                  {item.quantity} × {fcfa(item.unit_price)}
                </p>
              </div>
              <span className="shrink-0 font-display text-sm font-bold tabular-nums text-vert-actif">
                {fcfa(item.unit_price * item.quantity)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="space-y-1.5 border-t border-ligne bg-brume px-5 py-4 text-sm">
          <div className="flex justify-between text-encre/70">
            <dt>Sous-total</dt>
            <dd className="tabular-nums text-encre">{fcfa(itemsTotal)}</dd>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-encre/70">
              <dt>Réduction</dt>
              <dd className="tabular-nums text-succes">−{fcfa(discount)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4 text-encre/70">
            <dt>Livraison</dt>
            <dd className="text-right tabular-nums text-encre">
              {deliveryFee > 0
                ? fcfa(order.delivery_fee)
                : deliveryFeeUnknown
                  ? isActive
                    ? "À voir avec le vendeur"
                    : "Non précisée"
                  : "Gratuite"}
            </dd>
          </div>
          <div className="flex items-baseline justify-between border-t border-ligne pt-2.5">
            <dt className="font-semibold text-encre">Total</dt>
            <dd className="font-display text-lg font-extrabold tabular-nums text-vert-actif">
              {fcfa(order.total_amount)}
            </dd>
          </div>
        </dl>

        <dl className="divide-y divide-ligne border-t border-ligne px-5 text-sm">
          <div className="flex justify-between gap-4 py-2.5">
            <dt className="text-encre/70">Paiement</dt>
            <dd className="text-right font-medium text-encre">
              {PAYMENT_LABELS[order.payment_method] ?? order.payment_method}
            </dd>
          </div>
          {order.delivery_address && (
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="shrink-0 text-encre/70">Adresse</dt>
              <dd className="text-right font-medium text-encre">{order.delivery_address}</dd>
            </div>
          )}
          {order.delivery_lat != null && order.delivery_lng != null && (
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="text-encre/70">Position</dt>
              <dd>
                <a
                  href={`https://www.google.com/maps?q=${order.delivery_lat},${order.delivery_lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-vert-actif transition-colors hover:text-vert-sapin"
                >
                  Voir sur la carte
                </a>
              </dd>
            </div>
          )}
        </dl>
      </section>

      {isActive && (
        <div className="mt-4 text-center">
          <CancelOrderButton orderId={order.id} />
        </div>
      )}

      {receiptItems.length > 0 && !isCancelled && (
        <section className="mt-8">
          <h2 className="font-display text-base font-semibold text-encre">Laisser un avis</h2>
          {isDelivered ? (
            <div className="mt-3 flex flex-col gap-3">
              {Array.from(new Map(receiptItems.map((item) => [item.product_id, item])).values()).map((item) => {
                const existing = reviewsByProduct.get(item.product_id);
                return (
                  <ReviewForm
                    key={item.product_id}
                    orderId={order.id}
                    productId={item.product_id}
                    productTitle={item.product_title}
                    initialRating={existing?.rating ?? null}
                    initialComment={existing?.comment ?? null}
                  />
                );
              })}
            </div>
          ) : (
            <p className="mt-1 text-sm text-encre/70">
              Tu pourras noter tes articles une fois la commande livrée.
            </p>
          )}
        </section>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/${shopSlug}`}
          className="flex h-11 items-center sm:flex-1 justify-center rounded-xl bg-vert-actif px-4 text-sm font-semibold text-ivoire transition hover:bg-vert-sapin"
        >
          Continuer mes achats
        </Link>
        {user ? (
          <Link
            href="/compte"
            className="flex h-11 items-center sm:flex-1 justify-center rounded-xl border border-ligne bg-white px-4 text-sm font-semibold text-encre transition hover:border-vert-actif hover:text-vert-actif"
          >
            Mes commandes
          </Link>
        ) : null}
      </div>
    </main>
  );
}

function NextStep({ index, title, children }: { index: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-vert-actif/10 text-xs font-bold text-vert-actif"
      >
        {index}
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-sm font-semibold text-encre">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-encre/70">{children}</p>
      </div>
    </li>
  );
}
