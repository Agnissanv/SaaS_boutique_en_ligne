"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useShopCart } from "@/lib/cart/useShopCart";
import { createClient } from "@/lib/supabase/client";
import { notifyVendorNewOrder } from "./notify-vendor-action";

type Step = "panier" | "commande";

/**
 * Recolorée en charte KEVA le 15/09/2026 (côté client) — pure recolor,
 * aucune logique modifiée (RPC create_order, geolocalisation, notification
 * vendeur best-effort). Montants en IBM Plex Mono/Cuivre Profond, boutons
 * principaux en Cuivre Profond, focus des champs en Vert Actif, messages
 * d'erreur/succès sur les tokens sémantiques.
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
  const [paymentMethod, setPaymentMethod] = useState<"cash_on_delivery" | "mobile_money">(
    "cash_on_delivery"
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setPending(true);

    const supabase = createClient();
    const { data: orderId, error } = await supabase.rpc("create_order", {
      p_shop_id: shopId,
      p_customer_name: customerName,
      p_customer_phone: customerPhone,
      p_delivery_address: deliveryAddress,
      p_payment_method: paymentMethod,
      p_items: items.map((i) => ({
        product_id: i.productId,
        variant_ids: i.variantIds ?? [],
        quantity: i.quantity,
      })),
      p_delivery_lat: deliveryLat,
      p_delivery_lng: deliveryLng,
      p_customer_email: customerEmail.trim() || null,
    });

    setPending(false);

    if (error || !orderId) {
      setError(
        error?.message?.includes("Stock insuffisant")
          ? error.message
          : "Impossible de finaliser la commande. Réessaie."
      );
      return;
    }

    clear();
    // Best-effort, non bloquant : on ne fait jamais attendre le client pour
    // l'envoi d'un email au vendeur (voir notify-vendor-action.ts).
    notifyVendorNewOrder(orderId).catch(() => {});
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
                <p className="font-mono text-sm text-cuivre-profond">{item.price} FCFA</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) =>
                    updateQuantity(item.key, Math.max(1, Number(e.target.value) || 1))
                  }
                  className="w-16 rounded-md border border-ligne px-2 py-1 text-sm focus:border-vert-actif focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeItem(item.key)}
                  className="text-sm text-erreur underline"
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
            <dd className="font-mono text-cuivre-profond">{total} FCFA</dd>
          </div>
          <div className="flex justify-between py-2 text-encre/70">
            <dt>Livraison</dt>
            <dd className="font-mono text-cuivre-profond">
              {deliveryFee != null ? `${deliveryFee} FCFA` : "à confirmer avec le vendeur"}
            </dd>
          </div>
          <div className="flex justify-between py-2 text-base font-medium text-encre">
            <dt>Total</dt>
            <dd className="font-mono text-cuivre-profond">{total + (deliveryFee ?? 0)} FCFA</dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={() => setStep("commande")}
          className="mt-4 w-full rounded-md bg-cuivre-profond px-4 py-2 text-sm font-medium text-ivoire hover:bg-cuivre"
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
          <dd className="font-mono text-cuivre-profond">{total} FCFA</dd>
        </div>
        <div className="flex justify-between py-2 text-encre/70">
          <dt>Livraison</dt>
          <dd className="font-mono text-cuivre-profond">
            {deliveryFee != null ? `${deliveryFee} FCFA` : "à confirmer avec le vendeur"}
          </dd>
        </div>
        <div className="flex justify-between py-2 text-base font-medium text-encre">
          <dt>Total à payer</dt>
          <dd className="font-mono text-cuivre-profond">{total + (deliveryFee ?? 0)} FCFA</dd>
        </div>
      </dl>

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

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-encre">Mode de paiement</legend>
        <label className="flex items-center gap-2 text-sm text-encre">
          <input
            type="radio"
            name="paymentMethod"
            checked={paymentMethod === "cash_on_delivery"}
            onChange={() => setPaymentMethod("cash_on_delivery")}
          />
          Paiement à la livraison
        </label>
        <label className="flex items-center gap-2 text-sm text-encre/40">
          <input type="radio" name="paymentMethod" disabled />
          Mobile Money (Wave, Orange Money...) — bientôt disponible
        </label>
      </fieldset>

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
          className="ml-auto rounded-md bg-cuivre-profond px-4 py-2 text-sm font-medium text-ivoire hover:bg-cuivre disabled:opacity-50"
        >
          {pending ? "Envoi..." : "Confirmer la commande"}
        </button>
      </div>
    </form>
  );
}
