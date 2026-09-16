"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveProduct, type ProductFormState } from "./actions";
import {
  uploadShopAssetImage,
  deleteShopAssetImageByUrl,
  ImageUploadError,
} from "@/lib/supabase/storage";
import { CATEGORIES } from "@/lib/categories";
import { NativeSelect } from "@/components/native-select";

type Variant = { name: string; value: string };
type Group = { name: string; values: string };

type Product = {
  // Optionnel : absent en création normale ET en duplication (voir
  // ProductForm plus bas). Présent uniquement en modification d'un produit
  // existant — c'est ce qui distingue les deux cas, pas juste `product !== null`.
  id?: string;
  title: string;
  description: string | null;
  category: string | null;
  price: number;
  compare_at_price: number | null;
  stock: number;
  tags: string[] | null;
  stock_alert_threshold: number | null;
};

const MAX_PHOTOS = 6;
const MAX_VARIANT_GROUPS = 6;

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 rounded-md bg-cuivre-profond px-4 py-2 text-sm font-medium text-ivoire hover:bg-cuivre disabled:opacity-50"
    >
      {pending ? "Enregistrement..." : isEdit ? "Enregistrer" : "Ajouter le produit"}
    </button>
  );
}

/** Regroupe les variantes existantes par nom, dans l'ordre où elles apparaissent. */
function groupsFromVariants(variants: Variant[]): Group[] {
  const order: string[] = [];
  for (const v of variants) {
    if (!order.includes(v.name)) order.push(v.name);
  }
  return order.map((name) => ({
    name,
    values: variants
      .filter((v) => v.name === name)
      .map((v) => v.value)
      .join(", "),
  }));
}

/** Upload multi-photos (1 à 6) avec aperçus et suppression individuelle. */
function PhotoGallery({ initialUrls }: { initialUrls: string[] }) {
  const [urls, setUrls] = useState<string[]>(initialUrls);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    const remainingSlots = MAX_PHOTOS - urls.length;
    if (remainingSlots <= 0) {
      setError(`Maximum ${MAX_PHOTOS} photos.`);
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const toUpload = files.slice(0, remainingSlots);
      const uploaded: string[] = [];
      for (const file of toUpload) {
        const { url } = await uploadShopAssetImage("products", file);
        uploaded.push(url);
      }
      setUrls((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(
        err instanceof ImageUploadError
          ? err.message
          : "Échec de l'upload. Réessaie."
      );
    } finally {
      setUploading(false);
    }
  }

  function handleRemove(url: string) {
    deleteShopAssetImageByUrl(url).catch(() => {});
    setUrls((prev) => prev.filter((u) => u !== url));
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-encre">
        Photos <span className="text-encre/50">(jusqu&apos;à {MAX_PHOTOS})</span>
      </label>
      {urls.map((url) => (
        <input key={url} type="hidden" name="imageUrls" value={url} />
      ))}
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {urls.map((url) => (
            <div key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- images uploadées par l'utilisateur, source dynamique */}
              <img
                src={url}
                alt="Photo produit"
                className="h-20 w-20 rounded object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemove(url)}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-cuivre-profond text-xs text-ivoire"
                aria-label="Retirer cette photo"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {urls.length < MAX_PHOTOS && (
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleChange}
          disabled={uploading}
          className="text-sm"
        />
      )}
      {uploading && <p className="text-xs text-encre/60">Envoi en cours...</p>}
      {error && <p className="text-xs text-erreur">{error}</p>}
    </div>
  );
}

/**
 * Groupes de variantes à nom libre (ex : "Taille", "Couleur", "Matière"...),
 * plutôt que les deux champs figés "Tailles"/"Couleurs" d'avant — demandé
 * par Isaac le 13/09/2026 pour que le vendeur puisse décrire n'importe quel
 * type de variante selon son produit, pas seulement taille et couleur.
 */
function VariantGroups({ initialVariants }: { initialVariants: Variant[] }) {
  const [groups, setGroups] = useState<Group[]>(() => {
    const initial = groupsFromVariants(initialVariants);
    return initial.length > 0 ? initial : [{ name: "", values: "" }];
  });

  function updateGroup(index: number, patch: Partial<Group>) {
    setGroups((prev) => prev.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  }
  function addGroup() {
    setGroups((prev) =>
      prev.length >= MAX_VARIANT_GROUPS ? prev : [...prev, { name: "", values: "" }]
    );
  }
  function removeGroup(index: number) {
    setGroups((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  return (
    <fieldset className="flex flex-col gap-3 rounded-md border border-ligne p-3">
      <legend className="px-1 text-xs font-medium text-encre/60">
        Variantes (optionnel)
      </legend>
      <p className="text-xs text-encre/50">
        Ex : un groupe « Taille » avec les valeurs « S, M, L, XL », un groupe
        « Couleur » avec « Rouge, Bleu, Noir »... Ajoute autant de groupes que
        nécessaire (Matière, Pointure...). Le client choisira une valeur par
        groupe.
      </p>
      {groups.map((group, index) => (
        <div key={index} className="flex flex-col gap-1 rounded border border-ligne p-2">
          <div className="flex items-center gap-2">
            <input
              value={group.name}
              onChange={(e) => updateGroup(index, { name: e.target.value })}
              placeholder="Nom du groupe (ex : Taille)"
              maxLength={40}
              className="flex-1 rounded-md border border-ligne px-3 py-1.5 text-sm"
            />
            {groups.length > 1 && (
              <button
                type="button"
                onClick={() => removeGroup(index)}
                className="text-xs text-erreur underline"
              >
                Retirer
              </button>
            )}
          </div>
          <input
            value={group.values}
            onChange={(e) => updateGroup(index, { values: e.target.value })}
            placeholder="Valeurs séparées par une virgule (ex : S, M, L, XL)"
            maxLength={300}
            className="rounded-md border border-ligne px-3 py-1.5 text-sm"
          />
          {/* Un couple nom/valeurs par groupe non vide, envoyé au serveur. */}
          {group.name.trim() && group.values.trim() && (
            <>
              <input type="hidden" name="variantGroupName" value={group.name.trim()} />
              <input type="hidden" name="variantGroupValues" value={group.values} />
            </>
          )}
        </div>
      ))}
      {groups.length < MAX_VARIANT_GROUPS && (
        <button
          type="button"
          onClick={addGroup}
          className="w-fit text-xs font-medium text-encre underline"
        >
          + Ajouter un groupe de variantes
        </button>
      )}
    </fieldset>
  );
}

/**
 * Formulaire produit recoloré le 15/09/2026 en même temps que sa
 * reconstruction "langage natif" (dashboard vendeur — voir
 * decisions-techniques.md) : ce fichier avait été oublié lors de
 * l'application de la charte KEVA au reste du dashboard (classes Tailwind
 * grises/rouges génériques encore en place, signalé comme "non fait" à
 * l'époque). Recoloré au passage plutôt que dans une passe séparée, puisque
 * chaque champ était de toute façon rouvert ici pour le `<select>`/les
 * champs numériques. `<select>` catégorie → `NativeSelect` ; prix/prix
 * barré/stock → `type="text" inputMode="numeric"` (même raisonnement que le
 * frais de livraison de `shop-form.tsx` : un prix arbitraire ne se prête
 * pas à un compteur [−]/[+], mais autant retirer les flèches du navigateur).
 */
export function ProductForm({
  product,
  variants,
  images,
  canManageStock = true,
  canUseVariants = true,
  canUseAdvancedStockAlerts = false,
}: {
  product: Product | null;
  variants: Variant[];
  images: string[];
  /**
   * Plan Starter : pas de gestion de stock ni de variantes (spec du
   * 15/09/2026 confirmée par Isaac — voir produits/actions.ts pour
   * l'application côté serveur, qui reste la source de vérité). Par défaut
   * à `true` pour ne rien changer si jamais un appelant oublie de passer ces
   * props — le blocage réel est de toute façon revérifié côté serveur.
   */
  canManageStock?: boolean;
  canUseVariants?: boolean;
  /**
   * Seuil d'alerte personnalisable par produit — plan Pro uniquement
   * (`has_advanced_stock_alerts`, ajouté le 16/09/2026). Par défaut à
   * `false` (contrairement aux deux flags ci-dessus) : un champ en plus
   * caché par défaut est un risque bien plus faible qu'un champ de gestion
   * de stock manquant par erreur.
   */
  canUseAdvancedStockAlerts?: boolean;
}) {
  const initialState: ProductFormState = {};
  const [state, formAction] = useActionState(saveProduct, initialState);

  return (
    <form action={formAction} className="mt-6 flex max-w-md flex-col gap-4">
      {product?.id && <input type="hidden" name="productId" value={product.id} />}

      <div className="flex flex-col gap-1">
        <label htmlFor="title" className="text-sm font-medium text-encre">
          Titre du produit
        </label>
        <input
          id="title"
          name="title"
          required
          minLength={2}
          maxLength={120}
          defaultValue={product?.title ?? ""}
          placeholder="Ex : Robe wax bleue"
          className="rounded-md border border-ligne px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm font-medium text-encre">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={product?.description ?? ""}
          placeholder="Matière, coupe, entretien..."
          className="rounded-md border border-ligne px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="category" className="text-sm font-medium text-encre">
          Catégorie
        </label>
        <NativeSelect
          id="category"
          name="category"
          label="Catégorie"
          defaultValue={product?.category ?? ""}
          options={[
            { value: "", label: "Non catégorisé" },
            ...CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
          ]}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="tags" className="text-sm font-medium text-encre">
          Tags <span className="text-encre/50">(optionnel)</span>
        </label>
        <input
          id="tags"
          name="tags"
          defaultValue={(product?.tags ?? []).join(", ")}
          placeholder="promo, nouveau, tendance"
          maxLength={300}
          className="rounded-md border border-ligne px-3 py-2 text-sm"
        />
        <p className="text-xs text-encre/50">
          Mots-clés séparés par une virgule, utiles pour la recherche.
        </p>
      </div>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="price" className="text-sm font-medium text-encre">
            Prix (FCFA)
          </label>
          <input
            id="price"
            name="price"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            required
            defaultValue={product?.price ?? ""}
            className="rounded-md border border-ligne px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="compareAtPrice" className="text-sm font-medium text-encre">
            Prix barré <span className="text-encre/50">(optionnel)</span>
          </label>
          <input
            id="compareAtPrice"
            name="compareAtPrice"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            defaultValue={product?.compare_at_price ?? ""}
            className="rounded-md border border-ligne px-3 py-2 text-sm"
          />
        </div>
      </div>

      {canManageStock ? (
        <div className="flex flex-col gap-1">
          <label htmlFor="stock" className="text-sm font-medium text-encre">
            Stock disponible
          </label>
          <input
            id="stock"
            name="stock"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            required
            defaultValue={product?.stock ?? 0}
            className="rounded-md border border-ligne px-3 py-2 text-sm"
          />
        </div>
      ) : null}

      {canManageStock && canUseAdvancedStockAlerts ? (
        <div className="flex flex-col gap-1">
          <label htmlFor="stockAlertThreshold" className="text-sm font-medium text-encre">
            Seuil d&apos;alerte stock bas <span className="text-encre/50">(optionnel)</span>
          </label>
          <input
            id="stockAlertThreshold"
            name="stockAlertThreshold"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            defaultValue={product?.stock_alert_threshold ?? ""}
            placeholder="5 par défaut"
            className="rounded-md border border-ligne px-3 py-2 text-sm"
          />
          <p className="text-xs text-encre/50">
            Tu reçois un email dès que le stock de ce produit passe à ou sous
            ce seuil suite à une commande.
          </p>
        </div>
      ) : null}

      {!canManageStock && (
        <p className="rounded-md border border-dashed border-ligne bg-brume px-3 py-2 text-xs text-encre/60">
          Gestion du stock disponible à partir du plan Business.
        </p>
      )}

      {canUseVariants ? (
        <VariantGroups initialVariants={variants} />
      ) : (
        <p className="rounded-md border border-dashed border-ligne bg-brume px-3 py-2 text-xs text-encre/60">
          Variantes (taille, couleur...) disponibles à partir du plan Business.
        </p>
      )}

      <PhotoGallery initialUrls={images} />

      {state.error && <p className="text-sm text-erreur">{state.error}</p>}

      <SubmitButton isEdit={Boolean(product?.id)} />
    </form>
  );
}
