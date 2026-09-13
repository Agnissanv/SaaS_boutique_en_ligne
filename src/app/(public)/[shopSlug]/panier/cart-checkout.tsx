"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useShopCart } from "@/lib/cart/useShopCart";
import { createClient } from "@/lib/supabase/client";
import { notifyVendorNewOrder } from "./notify-vendor-action";

type Step = "panier" | "commande";

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
        <p className="text-sm text-gray-600">Ton panier est vide.</p>
        <Link href={`/${shopSlug}`} className="mt-2 inline-block text-sm underline">
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
        <ul className="divide-y divide-gray-200">
          {items.map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{item.title}</p>
                {item.variantLabel && (
                  <p className="text-xs text-gray-500">{item.variantLabel}</p>
                )}
                <p className="text-sm text-gray-600">{item.price} FCFA</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) =>
                    updateQuantity(item.key, Math.max(1, Number(e.target.value) || 1))
                  }
                  className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeItem(item.key)}
                  className="text-sm text-red-600 underline"
                >
                  Retirer
                </button>
              </div>
            </li>
          ))}
        </ul>

        <dl className="mt-4 divide-y divide-gray-100 text-sm">
          <div className="flex justify-between py-1 text-gray-600">
            <dt>Sous-total</dt>
            <dd>{total} FCFA</dd>
          </div>
          <div className="flex justify-between py-1 text-gray-600">
            <dt>Livraison</dt>
            <dd>{deliveryFee != null ? `${deliveryFee} FCFA` : "à confirmer avec le vendeur"}</dd>
          </div>
          <div className="flex justify-between py-1 text-base font-medium text-gray-900">
            <dt>Total</dt>
            <dd>{total + (deliveryFee ?? 0)} FCFA</dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={() => setStep("commande")}
          className="mt-4 w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white"
        >
          Passer la commande
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmitOrder} className="mt-6 flex flex-col gap-4">
      <dl className="divide-y divide-gray-100 text-sm">
        <div className="flex justify-between py-1 text-gray-600">
          <dt>Sous-total</dt>
          <dd>{total} FCFA</dd>
        </div>
        <div className="flex justify-between py-1 text-gray-600">
          <dt>Livraison</dt>
          <dd>{deliveryFee != null ? `${deliveryFee} FCFA` : "à confirmer avec le vendeur"}</dd>
        </div>
        <div className="flex justify-between py-1 text-base font-medium text-gray-900">
          <dt>Total à payer</dt>
          <dd>{total + (deliveryFee ?? 0)} FCFA</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-1">
        <label htmlFor="customerName" className="text-sm font-medium text-gray-700">
          Nom complet
        </label>
        <input
          id="customerName"
          required
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="customerPhone" className="text-sm font-medium text-gray-700">
          Téléphone
        </label>
        <input
          id="customerPhone"
          type="tel"
          required
          placeholder="+225 07 00 00 00 00"
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="customerEmail" className="text-sm font-medium text-gray-700">
          Email <span className="text-gray-400">(optionnel)</span>
        </label>
        <input
          id="customerEmail"
          type="email"
          placeholder="Pour être prévenu(e) de l'avancement de ta commande"
          value={customerEmail}
          onChange={(e) => setCustomerEmail(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="deliveryAddress" className="text-sm font-medium text-gray-700">
          Adresse de livraison
        </label>
        <textarea
          id="deliveryAddress"
          rows={2}
          required
          placeholder="Ex : Cocody Angré, 8e tranche, non loin de la pharmacie..."
          value={deliveryAddress}
          onChange={(e) => setDeliveryAddress(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <p className="text-xs text-gray-400">
          Décris le lieu du mieux possible : le vendeur t&apos;appellera pour
          préciser si besoin.
        </p>

        <button
          type="button"
          onClick={handleShareLocation}
          disabled={geoStatus === "pending"}
          className="mt-1 w-fit rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 disabled:opacity-50"
        >
          {geoStatus === "done"
            ? "Position partagée ✓"
            : geoStatus === "pending"
            ? "Localisation en cours..."
            : "📍 Partager ma position (optionnel)"}
        </button>
        {geoStatus === "done" && (
          <p className="text-xs text-green-600">
            Ta position exacte sera transmise au vendeur en plus de l&apos;adresse.
          </p>
        )}
        {geoStatus === "error" && (
          <p className="text-xs text-gray-500">
            Position indisponible (refusée ou non supportée) — pas de souci,
            l&apos;adresse écrite suffit.
          </p>
        )}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-gray-700">Mode de paiement</legend>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            name="paymentMethod"
            checked={paymentMethod === "cash_on_delivery"}
            onChange={() => setPaymentMethod("cash_on_delivery")}
          />
          Paiement à la livraison
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input type="radio" name="paymentMethod" disabled />
          Mobile Money (Wave, Orange Money...) — bientôt disponible
        </label>
      </fieldset>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setStep("panier")}
          className="text-sm text-gray-500 underline"
        >
          Retour au panier
        </button>
        <button
          type="submit"
          disabled={pending}
          className="ml-auto rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Envoi..." : "Confirmer la commande"}
        </button>
      </div>
    </form>
  );
}
