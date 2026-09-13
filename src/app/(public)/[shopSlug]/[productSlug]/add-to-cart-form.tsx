"use client";

import { useState } from "react";
import Link from "next/link";
import { useShopCart } from "@/lib/cart/useShopCart";

type Variant = { id: string; name: string; value: string; extra_price: number };

export function AddToCartForm({
  shopSlug,
  productId,
  productSlug,
  title,
  price,
  imageUrl,
  variants,
  stock,
}: {
  shopSlug: string;
  productId: string;
  productSlug: string;
  title: string;
  price: number;
  imageUrl?: string;
  variants: Variant[];
  stock: number;
}) {
  const { addItem, count } = useShopCart(shopSlug);
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  if (stock <= 0) {
    return <p className="mt-4 text-sm text-red-600">Rupture de stock.</p>;
  }

  const selectedVariant = variants.find((v) => v.id === variantId);
  const unitPrice = price + (selectedVariant?.extra_price ?? 0);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    addItem({
      productId,
      productSlug,
      title,
      price: unitPrice,
      imageUrl,
      variantId: selectedVariant?.id,
      variantLabel: selectedVariant
        ? `${selectedVariant.name} : ${selectedVariant.value}`
        : undefined,
      quantity,
    });
    setJustAdded(true);
  }

  return (
    <form onSubmit={handleAdd} className="mt-4 flex flex-col gap-3">
      {variants.length > 0 && (
        <div className="flex flex-col gap-1">
          <label htmlFor="variant" className="text-sm font-medium text-gray-700">
            Option
          </label>
          <select
            id="variant"
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} : {v.value}
                {v.extra_price ? ` (+${v.extra_price} FCFA)` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center gap-3">
        <label htmlFor="quantity" className="text-sm font-medium text-gray-700">
          Quantité
        </label>
        <input
          id="quantity"
          type="number"
          min={1}
          max={stock}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
          className="w-20 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white"
      >
        Ajouter au panier — {unitPrice * quantity} FCFA
      </button>

      {justAdded && (
        <p className="text-sm text-green-600">
          Ajouté au panier.{" "}
          <Link href={`/${shopSlug}/panier`} className="underline">
            Voir le panier ({count})
          </Link>
        </p>
      )}
    </form>
  );
}
