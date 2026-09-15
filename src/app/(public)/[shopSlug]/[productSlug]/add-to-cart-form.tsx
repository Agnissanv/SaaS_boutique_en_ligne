"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useShopCart } from "@/lib/cart/useShopCart";

type Variant = { id: string; name: string; value: string; extra_price: number };

/**
 * Sélection de variantes — corrigé le 13/09/2026 (signalé par Isaac en
 * testant : "les tailles et couleurs sont mélangées, le client ne peut pas
 * choisir une taille XL et une couleur"). Avant, un seul menu déroulant
 * listait toutes les variantes à plat (Taille:S, Taille:M, Couleur:Rouge...),
 * dont une seule pouvait être choisie au total.
 *
 * Désormais : un menu déroulant PAR GROUPE (`variant.name` — "Taille",
 * "Couleur"...), un par groupe distinct présent sur le produit. Le client
 * choisit une valeur dans chaque groupe, pas une seule au total. Voir la
 * migration 0010 pour le stockage de plusieurs variantes par article de
 * commande (`order_item_variants`).
 *
 * Recoloré le 15/09/2026 avec la charte KEVA (voir la refonte de la fiche
 * produit publique dans decisions-techniques.md) — comportement inchangé.
 */
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

  // Un groupe par nom distinct ("Taille", "Couleur"...), dans l'ordre où ils
  // apparaissent sur le produit.
  const groups = useMemo(() => {
    const seen: string[] = [];
    for (const v of variants) {
      if (!seen.includes(v.name)) seen.push(v.name);
    }
    return seen;
  }, [variants]);

  const [selectedByGroup, setSelectedByGroup] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const name of groups) {
      const first = variants.find((v) => v.name === name);
      if (first) initial[name] = first.id;
    }
    return initial;
  });
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  if (stock <= 0) {
    return <p className="mt-4 text-sm font-medium text-erreur">Rupture de stock.</p>;
  }

  const selectedVariants = groups
    .map((name) => variants.find((v) => v.id === selectedByGroup[name]))
    .filter((v): v is Variant => Boolean(v));
  const unitPrice = price + selectedVariants.reduce((sum, v) => sum + (v.extra_price ?? 0), 0);
  const variantLabel = selectedVariants.map((v) => `${v.name}: ${v.value}`).join(", ");

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    addItem({
      productId,
      productSlug,
      title,
      price: unitPrice,
      imageUrl,
      variantIds: selectedVariants.length > 0 ? selectedVariants.map((v) => v.id) : undefined,
      variantLabel: variantLabel || undefined,
      quantity,
    });
    setJustAdded(true);
  }

  return (
    <form onSubmit={handleAdd} className="mt-5 flex flex-col gap-3">
      {groups.map((name) => (
        <div key={name} className="flex flex-col gap-1">
          <label htmlFor={`variant-${name}`} className="text-sm font-medium text-encre">
            {name}
          </label>
          <select
            id={`variant-${name}`}
            value={selectedByGroup[name] ?? ""}
            onChange={(e) =>
              setSelectedByGroup((prev) => ({ ...prev, [name]: e.target.value }))
            }
            className="rounded-md border border-ligne bg-white px-3 py-2 text-sm text-encre focus:border-vert-actif focus:outline-none focus:ring-1 focus:ring-vert-actif"
          >
            {variants
              .filter((v) => v.name === name)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.value}
                  {v.extra_price ? ` (+${v.extra_price} FCFA)` : ""}
                </option>
              ))}
          </select>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <label htmlFor="quantity" className="text-sm font-medium text-encre">
          Quantité
        </label>
        <input
          id="quantity"
          type="number"
          min={1}
          max={stock}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
          className="w-20 rounded-md border border-ligne bg-white px-3 py-2 text-sm text-encre focus:border-vert-actif focus:outline-none focus:ring-1 focus:ring-vert-actif"
        />
      </div>

      <button
        type="submit"
        className="rounded-md bg-cuivre-profond px-4 py-2.5 text-sm font-semibold text-ivoire transition hover:bg-vert-sapin"
      >
        Ajouter au panier — {unitPrice * quantity} FCFA
      </button>

      {justAdded && (
        <p className="text-sm text-succes">
          Ajouté au panier.{" "}
          <Link href={`/${shopSlug}/panier`} className="font-medium text-vert-actif underline">
            Voir le panier ({count})
          </Link>
        </p>
      )}
    </form>
  );
}
