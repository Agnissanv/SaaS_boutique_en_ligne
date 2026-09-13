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

type Variant = { name: string; value: string };

type Product = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  price: number;
  compare_at_price: number | null;
  stock: number;
};

const MAX_PHOTOS = 6;

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
    >
      {pending ? "Enregistrement..." : isEdit ? "Enregistrer" : "Ajouter le produit"}
    </button>
  );
}

function variantsToText(variants: Variant[], name: string): string {
  return variants
    .filter((v) => v.name === name)
    .map((v) => v.value)
    .join(", ");
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
      <label className="text-sm font-medium text-gray-700">
        Photos <span className="text-gray-400">(jusqu&apos;à {MAX_PHOTOS})</span>
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
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-xs text-white"
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
      {uploading && <p className="text-xs text-gray-500">Envoi en cours...</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function ProductForm({
  product,
  variants,
  images,
}: {
  product: Product | null;
  variants: Variant[];
  images: string[];
}) {
  const initialState: ProductFormState = {};
  const [state, formAction] = useActionState(saveProduct, initialState);

  return (
    <form action={formAction} className="mt-6 flex max-w-md flex-col gap-4">
      {product && <input type="hidden" name="productId" value={product.id} />}

      <div className="flex flex-col gap-1">
        <label htmlFor="title" className="text-sm font-medium text-gray-700">
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
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={product?.description ?? ""}
          placeholder="Matière, coupe, entretien..."
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="category" className="text-sm font-medium text-gray-700">
          Catégorie
        </label>
        <select
          id="category"
          name="category"
          defaultValue={product?.category ?? ""}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Non catégorisé</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="price" className="text-sm font-medium text-gray-700">
            Prix (FCFA)
          </label>
          <input
            id="price"
            name="price"
            type="number"
            min={0}
            step={1}
            required
            defaultValue={product?.price ?? ""}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="compareAtPrice" className="text-sm font-medium text-gray-700">
            Prix barré <span className="text-gray-400">(optionnel)</span>
          </label>
          <input
            id="compareAtPrice"
            name="compareAtPrice"
            type="number"
            min={0}
            step={1}
            defaultValue={product?.compare_at_price ?? ""}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="stock" className="text-sm font-medium text-gray-700">
          Stock disponible
        </label>
        <input
          id="stock"
          name="stock"
          type="number"
          min={0}
          step={1}
          required
          defaultValue={product?.stock ?? 0}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <fieldset className="flex flex-col gap-3 rounded-md border border-gray-200 p-3">
        <legend className="px-1 text-xs font-medium text-gray-500">
          Variantes (optionnel)
        </legend>
        <div className="flex flex-col gap-1">
          <label htmlFor="tailles" className="text-sm font-medium text-gray-700">
            Tailles disponibles
          </label>
          <input
            id="tailles"
            name="tailles"
            defaultValue={variantsToText(variants, "Taille")}
            placeholder="S, M, L, XL"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-400">Séparées par une virgule.</p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="couleurs" className="text-sm font-medium text-gray-700">
            Couleurs disponibles
          </label>
          <input
            id="couleurs"
            name="couleurs"
            defaultValue={variantsToText(variants, "Couleur")}
            placeholder="Rouge, Bleu, Noir"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-400">Séparées par une virgule.</p>
        </div>
      </fieldset>

      <PhotoGallery initialUrls={images} />

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-green-600">Produit enregistré.</p>
      )}

      <SubmitButton isEdit={Boolean(product)} />
    </form>
  );
}
