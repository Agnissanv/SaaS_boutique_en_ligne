"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useShopCart } from "@/lib/cart/useShopCart";
import { createClient } from "@/lib/supabase/client";
import { notifyVendorNewOrder, notifyVendorLowStock } from "./notify-vendor-action";
import { verifyCheckoutCaptcha } from "./captcha-action";
import { TurnstileWidget } from "@/components/turnstile-widget";

// Captcha anti-robot (09/10/2026, migrations 0059/0060). Clé publique inscrite
// au build : absente (dev local sans clé, ou avant sa configuration sur
// Vercel), le widget n'est pas affiché et la commande part sans laissez-passer
// — accepté tant que la migration 0060 n'a pas rendu le captcha obligatoire.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

type Step = "panier" | "commande";

/**
 * Recolorée en charte KEVA le 15/09/2026 (côté client) — pure recolor,
 * aucune logique modifiée (RPC create_order, geolocalisation, notification
 * vendeur best-effort). Montants en IBM Plex Mono/Cuivre Profond, boutons
 * principaux en Cuivre Profond, focus des champs en Vert Actif, messages
 * d'erreur/succès sur les tokens sémantiques.
 *
 * Quantité reconstruite le 15/09/2026 (chantier "langage natif", voir
 * decisions-techniques.md — même geste que la fiche produit) : le
 * `<input type="number">` de chaque ligne de panier devient un compteur
 * [−] [+]. Logique de commande (RPC, géolocalisation) inchangée.
 *
 * **Paiement en ligne (Mobile Money via Nyole) construit puis abandonné le
 * 29/09/2026** : Isaac a tranché que KEVA ne doit pas centraliser l'argent
 * des ventes vendeur (voir claude/decisions-techniques.md pour le détail de
 * la marche arrière) — paiement à la livraison redevient donc le seul mode
 * de paiement du parcours de commande. Un vendeur qui veut du Mobile Money
 * renseigne désormais son propre numéro sur sa fiche boutique
 * (`shops.mobile_money_number`), affiché au client en dehors de ce
 * checkout, à régler directement entre eux — KEVA n'y participe pas.
 */
export function CartCheckout({
  shopId,
  shopSlug,
  deliveryFee,
}: {
  shopId: string;
  shopSlug: string;
  /** null = pas configuré par le vendeur -> "à confirmer avec le vendeur" (voir migration 0012). */
  deliveryFee: number | null;
}) {
  const router = useRouter();
  const { items, updateQuantity, removeItem, clear, total } = useShopCart(shopSlug);

  const [step, setStep] = useState<Step>("panier");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Codes promo — plan Pro (`can_use_promo_codes`, ajouté le 16/09/2026).
  // Volontairement pas de vérification/aperçu en direct : le rabais réel est
  // calculé et appliqué par `create_order` (source de vérité, migration
  // 0023), un code invalide/expiré remonte comme une erreur de commande
  // normale (voir handleSubmitOrder) plutôt qu'un aller-retour séparé.
  const [promoCode, setPromoCode] = useState("");
  // Jeton Turnstile (usage unique) et compteur pour en redemander un après
  // chaque tentative de commande.
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [captchaLoadFailed, setCaptchaLoadFailed] = useState(false);
  // true quand Cloudflare affiche la case à cocher (il a un doute) : le
  // client doit agir, ce n'est plus une simple attente.
  const [captchaNeedsInteraction, setCaptchaNeedsInteraction] = useState(false);
  const abandonedCartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Paniers abandonnés (23/09/2026, voir migration 0044) : capture
  // silencieuse et débattue (1,5s), dès que le client a rempli un nom et un
  // numéro qui ressemble à un vrai téléphone à l'étape "commande" — jamais
  // visible pour le client, jamais bloquant (best-effort, erreur ignorée).
  // Si la commande aboutit, la ligne est effacée juste après (voir
  // handleSubmitOrder ci-dessous). La relance elle-même reste 100% manuelle
  // côté vendeur (bouton WhatsApp sur /dashboard/paniers-abandonnes) :
  // aucun email, aucun envoi automatique fait au nom de KEVA — décision
  // explicite d'Isaac pour ne pas toucher au quota Brevo partagé par toute
  // la plateforme. Voir le raisonnement complet dans la migration.
  useEffect(() => {
    if (step !== "commande" || items.length === 0) return;

    const digits = customerPhone.replace(/[^0-9]/g, "");
    const name = customerName.trim();
    if (name.length === 0 || digits.length < 8) return;

    if (abandonedCartTimeoutRef.current) clearTimeout(abandonedCartTimeoutRef.current);
    abandonedCartTimeoutRef.current = setTimeout(() => {
      void (async () => {
        try {
          const supabase = createClient();
          await supabase.rpc("save_abandoned_cart", {
            p_shop_id: shopId,
            p_customer_name: name,
            p_customer_phone: customerPhone,
            p_cart_snapshot: items.map((i) => ({
              title: i.title,
              quantity: i.quantity,
              price: i.price,
              variantLabel: i.variantLabel ?? null,
            })),
            p_cart_total: total,
          });
        } catch {
          // Best-effort et invisible pour le client — jamais d'erreur affichée.
        }
      })();
    }, 1500);

    return () => {
      if (abandonedCartTimeoutRef.current) clearTimeout(abandonedCartTimeoutRef.current);
    };
  }, [step, customerName, customerPhone, items, total, shopId]);

  // Beaucoup d'adresses à Abidjan n'ont pas de repère écrit fiable : on
  // propose au client de partager sa position GPS en plus de l'adresse
  // texte (toujours obligatoire, elle, car ne dépend d'aucune permission).
  // Ça reste gratuit et sans clé API : un simple lien
  // https://www.google.com/maps?q=lat,lng suffit à ouvrir Google Maps.
  function handleShareLocation() {
    if (!navigator.geolocation) {
      setGeoStatus("error");
      return;
    }
    setGeoStatus("pending");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDeliveryLat(position.coords.latitude);
        setDeliveryLng(position.coords.longitude);
        setGeoStatus("done");
      },
      () => setGeoStatus("error"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  if (items.length === 0) {
    return (
      <div className="mt-6">
        <p className="text-sm text-encre/70">Ton panier est vide.</p>
        <Link href={`/${shopSlug}`} className="mt-2 inline-block text-sm text-vert-actif underline">
          Retour à la boutique
        </Link>
      </div>
    );
  }

  async function handleSubmitOrder(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Captcha : jeton Turnstile -> laissez-passer délivré par le serveur
    // (voir captcha-action.ts). Le jeton est consommé dans tous les cas : on
    // en redemande un nouveau après la tentative.
    let captchaPass: string | null = null;
    if (TURNSTILE_SITE_KEY) {
      if (!captchaToken) {
        setError(
          captchaLoadFailed
            ? "La vérification anti-robot n'a pas pu se charger. Recharge la page et réessaie."
            : captchaNeedsInteraction
              ? "Coche la case « Vérifiez que vous êtes humain » juste au-dessus, puis confirme la commande."
              : "Vérification anti-robot en cours, réessaie dans une seconde."
        );
        return;
      }
      setPending(true);
      const verification = await verifyCheckoutCaptcha(captchaToken);
      setCaptchaToken(null);
      setCaptchaResetKey((k) => k + 1);
      if ("error" in verification) {
        setPending(false);
        setError(verification.error);
        return;
      }
      captchaPass = verification.passId;
    }

    setPending(true);

    const supabase = createClient();
    const { data: orderId, error } = await supabase.rpc("create_order", {
      p_shop_id: shopId,
      p_customer_name: customerName,
      p_customer_phone: customerPhone,
      p_delivery_address: deliveryAddress,
      p_payment_method: "cash_on_delivery",
      p_items: items.map((i) => ({
        product_id: i.productId,
        variant_ids: i.variantIds ?? [],
        quantity: i.quantity,
      })),
      p_delivery_lat: deliveryLat,
      p_delivery_lng: deliveryLng,
      p_customer_email: customerEmail.trim() || null,
      p_promo_code: promoCode.trim() || null,
      p_captcha_pass: captchaPass,
    });

    setPending(false);

    if (error || !orderId) {
      // Corrigé le 22/09/2026 (audit pré-lancement) : `create_order` (RPC
      // plpgsql) lève volontairement des messages déjà clairs et en français
      // pour CHAQUE cas prévu (stock insuffisant, produit/variante retiré du
      // catalogue depuis l'ajout au panier, boutique désactivée entre-temps,
      // code promo invalide, etc. — voir 0031_product_universal_features.sql).
      // Un `raise exception` plpgsql sans SQLSTATE explicite remonte toujours
      // avec le code Postgres "P0001" (même convention déjà utilisée ailleurs
      // dans le projet pour "23505", cf. collaborateurs/profil actions) : on
      // s'en sert pour distinguer "erreur métier prévue, sûre à afficher
      // telle quelle" d'une vraie erreur inattendue (réseau, contrainte DB
      // non gérée) où le message brut ne serait pas approprié pour le client.
      // Avant ce correctif, seuls "Stock insuffisant" et "Code promo" étaient
      // reconnus par un `includes()` ad hoc : un panier avec un produit
      // supprimé/désactivé depuis son ajout (le panier vit en localStorage,
      // donc peut être ancien) affichait un message générique inutile.
      setError(
        error?.code === "P0001" && error.message
          ? error.message
          : "Impossible de finaliser la commande. Réessaie."
      );
      return;
    }

    clear();
    // Le panier a été confirmé, il n'est plus "abandonné" — voir migration
    // 0044. Best-effort : la commande a déjà réussi, une erreur ici ne doit
    // jamais faire échouer le parcours client.
    supabase
      .rpc("clear_abandoned_cart", { p_shop_id: shopId, p_customer_phone: customerPhone })
      .then(
        () => {},
        () => {}
      );
    // Best-effort, non bloquant : on ne fait jamais attendre le client pour
    // l'envoi d'un email au vendeur (voir notify-vendor-action.ts).
    notifyVendorNewOrder(orderId).catch(() => {});
    notifyVendorLowStock(orderId).catch(() => {});
    router.push(`/${shopSlug}/commande/${orderId}`);
  }

  if (step === "panier") {
    return (
      <div className="mt-6">
        <ul className="divide-y divide-ligne rounded-lg border border-ligne bg-white">
          {items.map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-encre">{item.title}</p>
                {item.variantLabel && (
                  <p className="text-xs text-encre/50">{item.variantLabel}</p>
                )}
                <p className="font-mono text-sm text-vert-actif">{item.price} FCFA</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <div className="flex items-center rounded-md border border-ligne">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.key, Math.max(1, item.quantity - 1))}
                    disabled={item.quantity <= 1}
                    aria-label="Diminuer la quantité"
                    className="px-2.5 py-1 text-base font-medium text-encre disabled:opacity-30"
                  >
                    −
                  </button>
                  <span aria-live="polite" className="min-w-[1.75rem] text-center font-mono text-sm text-encre">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.key, item.quantity + 1)}
                    aria-label="Augmenter la quantité"
                    className="px-2.5 py-1 text-base font-medium text-encre"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.key)}
                  className="text-xs text-erreur underline"
                >
                  Retirer
                </button>
              </div>
            </li>
          ))}
        </ul>

        <dl className="mt-4 divide-y divide-ligne rounded-lg border border-ligne bg-white px-4 text-sm">
          <div className="flex justify-between py-2 text-encre/70">
            <dt>Sous-total</dt>
            <dd className="font-mono text-vert-actif">{total} FCFA</dd>
          </div>
          <div className="flex justify-between py-2 text-encre/70">
            <dt>Livraison</dt>
            <dd className="font-mono text-vert-actif">
              {deliveryFee != null ? `${deliveryFee} FCFA` : "à confirmer avec le vendeur"}
            </dd>
          </div>
          <div className="flex justify-between py-2 text-base font-medium text-encre">
            <dt>Total</dt>
            <dd className="font-mono text-vert-actif">{total + (deliveryFee ?? 0)} FCFA</dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={() => setStep("commande")}
          className="mt-4 w-full rounded-md bg-vert-actif px-4 py-2 text-sm font-medium text-ivoire hover:bg-vert-sapin"
        >
          Passer la commande
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmitOrder} className="mt-6 flex flex-col gap-4">
      <dl className="divide-y divide-ligne rounded-lg border border-ligne bg-white px-4 text-sm">
        <div className="flex justify-between py-2 text-encre/70">
          <dt>Sous-total</dt>
          <dd className="font-mono text-vert-actif">{total} FCFA</dd>
        </div>
        <div className="flex justify-between py-2 text-encre/70">
          <dt>Livraison</dt>
          <dd className="font-mono text-vert-actif">
            {deliveryFee != null ? `${deliveryFee} FCFA` : "à confirmer avec le vendeur"}
          </dd>
        </div>
        <div className="flex justify-between py-2 text-base font-medium text-encre">
          <dt>Total à payer</dt>
          <dd className="font-mono text-vert-actif">{total + (deliveryFee ?? 0)} FCFA</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-1">
        <label htmlFor="promoCode" className="text-sm font-medium text-encre">
          Code promo <span className="text-encre/50">(optionnel)</span>
        </label>
        <input
          id="promoCode"
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value)}
          placeholder="Ex : BIENVENUE10"
          className="rounded-md border border-ligne px-3 py-2 text-sm uppercase focus:border-vert-actif focus:outline-none"
        />
        <p className="text-xs text-encre/50">
          Le rabais est appliqué au moment de valider la commande.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="customerName" className="text-sm font-medium text-encre">
          Nom complet
        </label>
        <input
          id="customerName"
          required
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className="rounded-md border border-ligne px-3 py-2 text-sm focus:border-vert-actif focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="customerPhone" className="text-sm font-medium text-encre">
          Téléphone
        </label>
        <input
          id="customerPhone"
          type="tel"
          required
          placeholder="+225 07 00 00 00 00"
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
          className="rounded-md border border-ligne px-3 py-2 text-sm focus:border-vert-actif focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="customerEmail" className="text-sm font-medium text-encre">
          Email <span className="text-encre/40">(optionnel)</span>
        </label>
        <input
          id="customerEmail"
          type="email"
          placeholder="Pour être prévenu(e) de l'avancement de ta commande"
          value={customerEmail}
          onChange={(e) => setCustomerEmail(e.target.value)}
          className="rounded-md border border-ligne px-3 py-2 text-sm focus:border-vert-actif focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="deliveryAddress" className="text-sm font-medium text-encre">
          Adresse de livraison
        </label>
        <textarea
          id="deliveryAddress"
          rows={2}
          required
          placeholder="Ex : Cocody Angré, 8e tranche, non loin de la pharmacie..."
          value={deliveryAddress}
          onChange={(e) => setDeliveryAddress(e.target.value)}
          className="rounded-md border border-ligne px-3 py-2 text-sm focus:border-vert-actif focus:outline-none"
        />
        <p className="text-xs text-encre/50">
          Décris le lieu du mieux possible : le vendeur t&apos;appellera pour
          préciser si besoin.
        </p>

        <button
          type="button"
          onClick={handleShareLocation}
          disabled={geoStatus === "pending"}
          className="mt-1 w-fit rounded-md border border-ligne px-3 py-1.5 text-xs font-medium text-encre hover:bg-brume disabled:opacity-50"
        >
          {geoStatus === "done"
            ? "Position partagée ✓"
            : geoStatus === "pending"
            ? "Localisation en cours..."
            : "📍 Partager ma position (optionnel)"}
        </button>
        {geoStatus === "done" && (
          <p className="text-xs text-succes">
            Ta position exacte sera transmise au vendeur en plus de l&apos;adresse.
          </p>
        )}
        {geoStatus === "error" && (
          <p className="text-xs text-encre/50">
            Position indisponible (refusée ou non supportée) — pas de souci,
            l&apos;adresse écrite suffit.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-encre">Mode de paiement</span>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-vert-actif bg-vert-actif/5 px-3.5 py-3 text-left text-sm text-encre">
          Paiement à la livraison
          <span
            aria-hidden="true"
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-vert-actif"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-vert-actif" />
          </span>
        </div>
        <p className="text-xs text-encre/50">
          Tu paies en espèces à la réception. Si le vendeur accepte le Mobile
          Money, son numéro est indiqué sur sa fiche boutique — à régler
          directement avec lui.
        </p>
      </div>

      {TURNSTILE_SITE_KEY ? (
        <TurnstileWidget
          siteKey={TURNSTILE_SITE_KEY}
          resetKey={captchaResetKey}
          onToken={setCaptchaToken}
          onLoadError={() => setCaptchaLoadFailed(true)}
          onInteractiveChange={setCaptchaNeedsInteraction}
        />
      ) : null}

      {error && <p className="text-sm text-erreur">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setStep("panier")}
          className="text-sm text-vert-actif underline"
        >
          Retour au panier
        </button>
        <button
          type="submit"
          disabled={pending}
          className="ml-auto rounded-md bg-vert-actif px-4 py-2 text-sm font-medium text-ivoire hover:bg-vert-sapin disabled:opacity-50"
        >
          {pending ? "Envoi..." : "Confirmer la commande"}
        </button>
      </div>
    </form>
  );
}
