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
import { NativeSelect } from "@/components/native-select";

type Shop = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  logo_url?: string | null;
  cover_url?: string | null;
  delivery_fee?: number | null;
  whatsapp_number?: string | null;
  notification_email?: string | null;
};

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 rounded-md bg-cuivre-profond px-4 py-2 text-sm font-medium text-ivoire hover:bg-cuivre disabled:opacity-50"
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
      <label className="text-sm font-medium text-encre">{label}</label>
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
            className="text-sm text-erreur underline"
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
          className="text-sm text-encre/80"
        />
      )}
      {uploading && <p className="text-xs text-encre/60">Envoi en cours...</p>}
      {error && <p className="text-xs text-erreur">{error}</p>}
    </div>
  );
}

/**
 * `<select>` de catégorie et champ frais de livraison reconstruits le
 * 15/09/2026 (chantier "langage natif", dashboard vendeur — voir
 * decisions-techniques.md) : le `<select>` devient `NativeSelect` (bouton +
 * feuille d'action, même motif que le tri marketplace), et le frais de
 * livraison passe de `type="number"` à `type="text" inputMode="numeric"` —
 * un prix arbitraire en FCFA ne se prête pas à un compteur [−]/[+] (contrairement
 * à la quantité du panier), mais garder `type="number"` affichait quand même
 * les flèches du navigateur sur desktop ; `inputMode="numeric"` donne le
 * clavier numérique sur mobile sans cet artefact. Validation serveur
 * inchangée (`saveShop` parse déjà la valeur en `Number`, quel que soit le
 * type d'input).
 */
export function ShopForm({ shop }: { shop: Shop | null }) {
  const initialState: ShopFormState = {};
  const [state, formAction] = useActionState(saveShop, initialState);

  return (
    <form action={formAction} className="mt-6 flex max-w-md flex-col gap-4">
      {shop && <input type="hidden" name="shopId" value={shop.id} />}

      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium text-encre">
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
          className="rounded-md border border-ligne px-3 py-2 text-sm focus:ring-2 focus:ring-vert-actif"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm font-medium text-encre">
          Description <span className="text-encre/50">(300 caractères max)</span>
        </label>
        <textarea
          id="description"
          name="description"
          maxLength={300}
          rows={3}
          defaultValue={shop?.description ?? ""}
          placeholder="Présente ta boutique en quelques mots..."
          className="rounded-md border border-ligne px-3 py-2 text-sm focus:ring-2 focus:ring-vert-actif"
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
          placeholder="Choisir une catégorie"
          defaultValue={shop?.category ?? ""}
          options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
        />
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
        <label htmlFor="deliveryFee" className="text-sm font-medium text-encre">
          Frais de livraison (FCFA) <span className="text-encre/50">(optionnel)</span>
        </label>
        <input
          id="deliveryFee"
          name="deliveryFee"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          defaultValue={shop?.delivery_fee ?? ""}
          placeholder="Ex : 1000"
          className="rounded-md border border-ligne px-3 py-2 text-sm focus:ring-2 focus:ring-vert-actif"
        />
        <p className="text-xs text-encre/50">
          Affiché au client avant qu&apos;il confirme sa commande. Laisse
          vide si le tarif dépend de la zone — le client saura alors que
          c&apos;est à confirmer avec toi.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="whatsappNumber" className="text-sm font-medium text-encre">
          Numéro WhatsApp <span className="text-encre/50">(optionnel)</span>
        </label>
        <input
          id="whatsappNumber"
          name="whatsappNumber"
          type="tel"
          placeholder="+225 07 00 00 00 00"
          defaultValue={shop?.whatsapp_number ?? ""}
          className="rounded-md border border-ligne px-3 py-2 text-sm focus:ring-2 focus:ring-vert-actif"
        />
        <p className="text-xs text-encre/50">
          Affiche un bouton « Contacter sur WhatsApp » sur ta boutique et tes
          fiches produit. Laisse vide pour ne pas l&apos;afficher.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="notificationEmail" className="text-sm font-medium text-encre">
          Email pour les notifications de commande{" "}
          <span className="text-encre/50">(optionnel)</span>
        </label>
        <input
          id="notificationEmail"
          name="notificationEmail"
          type="email"
          placeholder="Laisse vide pour ne recevoir aucun email"
          defaultValue={shop?.notification_email ?? ""}
          className="rounded-md border border-ligne px-3 py-2 text-sm focus:ring-2 focus:ring-vert-actif"
        />
        <p className="text-xs text-encre/50">
          Reçois un email à chaque nouvelle commande. Peut être différent de
          ton email de connexion.
        </p>
      </div>

      {shop && (
        <p className="text-xs text-encre/60">
          Lien public :{" "}
          <a
            href={`/${shop.slug}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-vert-sapin underline hover:text-vert-actif"
          >
            /{shop.slug}
          </a>{" "}
          (non modifiable ici)
        </p>
      )}

      {state.error && <p className="text-sm text-erreur">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-succes">Boutique enregistrée.</p>
      )}

      <SubmitButton isEdit={Boolean(shop)} />
    </form>
  );
}
