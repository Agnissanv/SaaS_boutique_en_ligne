"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveShop, type ShopFormState } from "./actions";
import {
  uploadShopAssetImage,
  deleteShopAssetImageByUrl,
  ImageUploadError,
} from "@/lib/supabase/storage";
import { CATEGORIES } from "@/lib/categories";

type Shop = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  logo_url?: string | null;
  cover_url?: string | null;
  delivery_fee?: number | null;
};

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
    >
      {pending ? "Enregistrement..." : isEdit ? "Enregistrer" : "Créer ma boutique"}
    </button>
  );
}

/** Upload d'une image unique (logo ou couverture) avec aperçu et suppression. */
function ImageField({
  label,
  fieldName,
  subpath,
  initialUrl,
}: {
  label: string;
  fieldName: string;
  subpath: string;
  initialUrl: string | null | undefined;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de re-sélectionner le même fichier plus tard
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const previousUrl = url;
      const { url: newUrl } = await uploadShopAssetImage(subpath, file);
      setUrl(newUrl);
      if (previousUrl) {
        // Best-effort : on ne bloque pas l'utilisateur si ça échoue.
        deleteShopAssetImageByUrl(previousUrl).catch(() => {});
      }
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

  function handleRemove() {
    if (url) deleteShopAssetImageByUrl(url).catch(() => {});
    setUrl("");
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input type="hidden" name={fieldName} value={url} />
      {url ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- images uploadées par l'utilisateur, source dynamique */}
          <img
            src={url}
            alt={label}
            className="h-16 w-16 rounded object-cover"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="text-sm text-red-600 underline"
          >
            Retirer
          </button>
        </div>
      ) : (
        <input
          type="file"
          accept="image/*"
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

export function ShopForm({ shop }: { shop: Shop | null }) {
  const initialState: ShopFormState = {};
  const [state, formAction] = useActionState(saveShop, initialState);

  return (
    <form action={formAction} className="mt-6 flex max-w-md flex-col gap-4">
      {shop && <input type="hidden" name="shopId" value={shop.id} />}

      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium text-gray-700">
          Nom de la boutique
        </label>
        <input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={80}
          defaultValue={shop?.name ?? ""}
          placeholder="Ex : Chez Awa Mode"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm font-medium text-gray-700">
          Description <span className="text-gray-400">(300 caractères max)</span>
        </label>
        <textarea
          id="description"
          name="description"
          maxLength={300}
          rows={3}
          defaultValue={shop?.description ?? ""}
          placeholder="Présente ta boutique en quelques mots..."
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
          required
          defaultValue={shop?.category ?? ""}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="" disabled>
            Choisir une catégorie
          </option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <ImageField
        label="Logo"
        fieldName="logoUrl"
        subpath="shop/logo"
        initialUrl={shop?.logo_url}
      />
      <ImageField
        label="Image de couverture"
        fieldName="coverUrl"
        subpath="shop/cover"
        initialUrl={shop?.cover_url}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="deliveryFee" className="text-sm font-medium text-gray-700">
          Frais de livraison (FCFA) <span className="text-gray-400">(optionnel)</span>
        </label>
        <input
          id="deliveryFee"
          name="deliveryFee"
          type="number"
          min={0}
          step={1}
          defaultValue={shop?.delivery_fee ?? ""}
          placeholder="Ex : 1000"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <p className="text-xs text-gray-400">
          Affiché au client avant qu&apos;il confirme sa commande. Laisse
          vide si le tarif dépend de la zone — le client saura alors que
          c&apos;est à confirmer avec toi.
        </p>
      </div>

      {shop && (
        <p className="text-xs text-gray-500">
          Lien public :{" "}
          <span className="font-mono">/{shop.slug}</span> (non modifiable ici)
        </p>
      )}

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-green-600">Boutique enregistrée.</p>
      )}

      <SubmitButton isEdit={Boolean(shop)} />
    </form>
  );
}
