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
 *
 * Sélecteurs reconstruits le 15/09/2026 (chantier "langage natif", voir
 * decisions-techniques.md) : les `<select>` par groupe de variante sont
 * remplacés par des puces à toucher directement (le choix se fait en un
 * tap, sans ouvrir de menu — mieux adapté qu'une feuille d'action à une
 * poignée de valeurs courtes comme des tailles ou des couleurs), et le
 * champ quantité `<input type="number">` (flèches du navigateur, jamais les
 * mêmes deux pixels selon l'OS) par un vrai compteur [−] / [+]. Comportement
 * et API du formulaire inchangés.
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
  accentColor,
}: {
  shopSlug: string;
  productId: string;
  productSlug: string;
  title: string;
  price: number;
  imageUrl?: string;
  variants: Variant[];
  stock: number;
  /**
   * Couleur d'accent de la boutique — plan Pro uniquement
   * (`can_customize_branding === "complete"`, ajouté le 16/09/2026, voir
   * migration 0022_shop_accent_color.sql). `null`/`undefined` garde la
   * couleur KEVA par défaut (classe Tailwind `bg-cuivre-profond`) : on
   * n'écrase le style qu'avec une couleur explicitement choisie par le
   * vendeur, jamais avec une valeur inventée.
   */
  accentColor?: string | null;
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
        <div key={name} className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-encre">{name}</span>
          <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
            {variants
              .filter((v) => v.name === name)
              .map((v) => {
                const isSelected = selectedByGroup[name] === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setSelectedByGroup((prev) => ({ ...prev, [name]: v.id }))}
                    className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                      isSelected
                        ? "border-cuivre-profond bg-cuivre-profond text-ivoire"
                        : "border-ligne bg-white text-encre"
                    }`}
                  >
                    {v.value}
                    {v.extra_price ? ` (+${v.extra_price} FCFA)` : ""}
                  </button>
                );
              })}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-encre">Quantité</span>
        <div className="flex items-center rounded-md border border-ligne">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            aria-label="Diminuer la quantité"
            className="px-3 py-2 text-base font-medium text-encre disabled:opacity-30"
          >
            −
          </button>
          <span aria-live="polite" className="min-w-[2rem] text-center font-mono text-sm text-encre">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(stock, q + 1))}
            disabled={quantity >= stock}
            aria-label="Augmenter la quantité"
            className="px-3 py-2 text-base font-medium text-encre disabled:opacity-30"
          >
            +
          </button>
        </div>
      </div>

      <button
        type="submit"
        style={accentColor ? { backgroundColor: accentColor } : undefined}
        className={`rounded-md px-4 py-2.5 text-sm font-semibold text-ivoire transition ${
          accentColor ? "opacity-100 hover:opacity-90" : "bg-cuivre-profond hover:bg-vert-sapin"
        }`}
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
