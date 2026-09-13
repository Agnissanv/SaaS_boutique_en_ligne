"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { updateProfile, type ProfileFormState } from "./actions";
import {
  uploadShopAssetImage,
  deleteShopAssetImageByUrl,
  ImageUploadError,
} from "@/lib/supabase/storage";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
    >
      {pending ? "Enregistrement..." : "Enregistrer"}
    </button>
  );
}

/** Upload de la photo de profil — même pattern que le logo boutique (shop-form.tsx). */
function AvatarField({ initialUrl }: { initialUrl: string | null }) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const previousUrl = url;
      const { url: newUrl } = await uploadShopAssetImage("profile/avatar", file);
      setUrl(newUrl);
      if (previousUrl) {
        deleteShopAssetImageByUrl(previousUrl).catch(() => {});
      }
    } catch (err) {
      setError(
        err instanceof ImageUploadError ? err.message : "Échec de l'upload. Réessaie."
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
      <label className="text-sm font-medium text-gray-700">Photo de profil</label>
      <input type="hidden" name="avatarUrl" value={url} />
      {url ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- image uploadée par l'utilisateur, source dynamique */}
          <img src={url} alt="Photo de profil" className="h-16 w-16 rounded-full object-cover" />
          <button type="button" onClick={handleRemove} className="text-sm text-red-600 underline">
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

export function ProfileForm({
  profile,
}: {
  profile: { displayName: string; phone: string; avatarUrl: string | null };
}) {
  const initialState: ProfileFormState = {};
  const [state, formAction] = useActionState(updateProfile, initialState);

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-4">
      <AvatarField initialUrl={profile.avatarUrl} />

      <div className="flex flex-col gap-1">
        <label htmlFor="displayName" className="text-sm font-medium text-gray-700">
          Nom d&apos;affichage
        </label>
        <input
          id="displayName"
          name="displayName"
          required
          minLength={2}
          maxLength={60}
          defaultValue={profile.displayName}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="phone" className="text-sm font-medium text-gray-700">
          Téléphone <span className="text-gray-400">(optionnel)</span>
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          placeholder="+225 07 00 00 00 00"
          defaultValue={profile.phone}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600">Profil enregistré.</p>}

      <SubmitButton />
    </form>
  );
}
