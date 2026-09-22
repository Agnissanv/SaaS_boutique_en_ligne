"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useShopCart } from "@/lib/cart/useShopCart";
import { getColorSwatch, isColorGroupName } from "@/lib/colors";

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
 *
 * Pastilles de couleur ajoutées le 22/09/2026 (refonte fiche produit,
 * mockup validé par Isaac, captures de référence avec de vraies pastilles
 * rondes) : le groupe dont le nom désigne une couleur (`isColorGroupName`,
 * src/lib/colors.ts) s'affiche en pastilles quand la valeur est reconnue
 * par la table de correspondance (`getColorSwatch`), avec repli en puce
 * texte sinon (ex. nom de collection) — jamais de couleur inventée. Tout
 * autre groupe ("Taille"...) garde les puces texte d'origine. Un seul CTA
 * "Ajouter au panier" conservé (décision d'Isaac, 22/09/2026) : pas de
 * bouton "Acheter maintenant" tant que CinetPay n'est pas branché.
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
   * couleur KEVA par défaut (classe Tailwind `bg-vert-actif`) : on
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
      {groups.map((name) => {
        const groupVariants = variants.filter((v) => v.name === name);

        if (isColorGroupName(name)) {
          const selectedValue = groupVariants.find((v) => v.id === selectedByGroup[name])?.value;
          return (
            <div key={name} className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-encre">
                {name}
                {selectedValue ? (
                  <span className="font-normal text-encre/55"> · {selectedValue}</span>
                ) : null}
              </span>
              <div role="radiogroup" aria-label={name} className="flex flex-wrap items-center gap-2.5">
                {groupVariants.map((v) => {
                  const isSelected = selectedByGroup[name] === v.id;
                  const hex = getColorSwatch(v.value);
                  const label = v.extra_price ? `${v.value} (+${v.extra_price} FCFA)` : v.value;

                  if (!hex) {
                    // Valeur non reconnue par la table de correspondance —
                    // repli en puce texte plutôt qu'une pastille inventée.
                    return (
                      <button
                        key={v.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setSelectedByGroup((prev) => ({ ...prev, [name]: v.id }))}
                        className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                          isSelected
                            ? "border-vert-actif bg-vert-actif text-ivoire"
                            : "border-ligne bg-white text-encre"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  }

                  return (
                    <button
                      key={v.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={label}
                      title={label}
                      onClick={() => setSelectedByGroup((prev) => ({ ...prev, [name]: v.id }))}
                      style={{ backgroundColor: hex }}
                      className={`h-8 w-8 rounded-full transition ${
                        hex.toLowerCase() === "#ffffff" ? "border border-ligne" : "border border-transparent"
                      } ${isSelected ? "ring-2 ring-vert-actif ring-offset-2 ring-offset-white" : ""}`}
                    />
                  );
                })}
              </div>
            </div>
          );
        }

        return (
          <div key={name} className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-encre">{name}</span>
            <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
              {groupVariants.map((v) => {
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
                        ? "border-vert-actif bg-vert-actif text-ivoire"
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
        );
      })}

      {/* Quantité + CTA regroupés sur une ligne le 22/09/2026 (refonte fiche
          produit, mockup validé) : le compteur reste discret à gauche, le
          bouton d'ajout occupe le reste de la largeur pour rester la cible
          la plus visible de la page — un seul CTA (voir commentaire du
          composant : pas de "Acheter maintenant" tant que CinetPay n'est
          pas branché). */}
      <div className="flex gap-2.5">
        <div className="flex h-12 items-center rounded-xl border border-ligne px-1">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            aria-label="Diminuer la quantité"
            className="px-2.5 text-base font-medium text-encre disabled:opacity-30"
          >
            −
          </button>
          <span aria-live="polite" className="min-w-[1.75rem] text-center font-mono text-sm font-medium text-encre">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(stock, q + 1))}
            disabled={quantity >= stock}
            aria-label="Augmenter la quantité"
            className="px-2.5 text-base font-medium text-encre disabled:opacity-30"
          >
            +
          </button>
        </div>

        <button
          type="submit"
          style={accentColor ? { backgroundColor: accentColor } : undefined}
          className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-ivoire shadow-[0_10px_20px_rgba(28,107,74,0.22)] transition ${
            accentColor ? "opacity-100 hover:opacity-90" : "bg-vert-actif hover:bg-vert-sapin"
          }`}
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
            <path d="M4 6.5h12l-1 9.5H5L4 6.5Z" />
            <path d="M7 6.5V5a3 3 0 0 1 6 0v1.5" />
          </svg>
          Ajouter au panier — {unitPrice * quantity} FCFA
        </button>
      </div>

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
