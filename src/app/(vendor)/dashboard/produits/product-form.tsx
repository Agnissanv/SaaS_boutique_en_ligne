"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveProduct, type ProductFormState } from "./actions";
import {
  uploadShopAssetImage,
  deleteShopAssetImageByUrl,
  ImageUploadError,
} from "@/lib/supabase/storage";
import { CATEGORIES } from "@/lib/categories";
import { NativeSelect } from "@/components/native-select";

type Variant = { name: string; value: string; sku?: string | null; barcode?: string | null };
type VariantValueRow = { value: string; sku: string; barcode: string };
type Group = { name: string; rows: VariantValueRow[] };

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
  // Lot "universel" ajouté le 22/09/2026 (migration 0031, cf. son en-tête
  // pour le contexte complet) — tous optionnels côté formulaire, jamais
  // requis pour enregistrer un produit.
  highlights?: string[] | null;
  sku?: string | null;
  barcode?: string | null;
  sale_price?: number | null;
  sale_starts_at?: string | null;
  sale_ends_at?: string | null;
};

const MAX_PHOTOS = 6;
const MAX_VARIANT_GROUPS = 6;
const MAX_VARIANT_VALUES_PER_GROUP = 20;
const MAX_HIGHLIGHTS = 10;

// Règles de validation d'image demandées par Isaac le 22/09/2026, reprises
// telles quelles du flux "Ajouter un produit" de Jumia Vendor Center (captures
// envoyées) : "L'image doit être comprise entre 500 x 500 et 2 000 x 2 000
// pixels [...] Taille maximale de l'image 2 Mo." Validation purement côté
// formulaire (aucune colonne base n'est nécessaire) — le fond blanc/l'absence
// de filigrane restent des recommandations affichées, pas des règles
// vérifiables automatiquement.
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MIN_IMAGE_DIMENSION = 500;
const MAX_IMAGE_DIMENSION = 2000;

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
    rows: variants
      .filter((v) => v.name === name)
      .map((v) => ({ value: v.value, sku: v.sku ?? "", barcode: v.barcode ?? "" })),
  }));
}

/** Lit les dimensions réelles d'une image sélectionnée, sans l'uploader. */
function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossible de lire cette image."));
    };
    img.src = url;
  });
}

/** "2026-09-22T14:30:00+00:00" -> "2026-09-22T14:30" (valeur attendue par un <input type="datetime-local">). */
function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Upload multi-photos (1 à 6) avec aperçus et suppression individuelle.
 *
 * Validation ajoutée le 22/09/2026 (cf. constantes plus haut) : les fichiers
 * hors gabarit (trop lourds, résolution hors plage) sont rejetés
 * individuellement AVANT l'upload, avec un message explicite — les autres
 * fichiers valides du même lot continuent d'être envoyés normalement plutôt
 * que de tout bloquer pour un seul fichier invalide.
 */
function PhotoGallery({ initialUrls }: { initialUrls: string[] }) {
  const [urls, setUrls] = useState<string[]>(initialUrls);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const candidates = files.slice(0, remainingSlots);
      const uploaded: string[] = [];
      const rejected: string[] = [];

      for (const file of candidates) {
        if (file.size > MAX_IMAGE_BYTES) {
          rejected.push(`${file.name} : dépasse 2 Mo`);
          continue;
        }

        let dimensions: { width: number; height: number };
        try {
          dimensions = await getImageDimensions(file);
        } catch {
          rejected.push(`${file.name} : image illisible`);
          continue;
        }

        if (
          dimensions.width < MIN_IMAGE_DIMENSION ||
          dimensions.height < MIN_IMAGE_DIMENSION ||
          dimensions.width > MAX_IMAGE_DIMENSION ||
          dimensions.height > MAX_IMAGE_DIMENSION
        ) {
          rejected.push(
            `${file.name} : résolution ${dimensions.width}x${dimensions.height}px hors de la plage ${MIN_IMAGE_DIMENSION}x${MIN_IMAGE_DIMENSION}–${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION}px`
          );
          continue;
        }

        const { url } = await uploadShopAssetImage("products", file);
        uploaded.push(url);
      }

      setUrls((prev) => [...prev, ...uploaded]);
      setError(rejected.length > 0 ? rejected.join(" · ") : null);
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
      {/*
        Tuile "Ajouter" refondue le 22/09/2026 : Isaac signalait que l'ajout
        de photo n'était "pas visible à l'œil nu" — c'était un `<input
        type="file">` natif sans aucun style (juste `text-sm`), qui ne
        ressemble à un bouton dans aucun navigateur. Remplacé par une vraie
        tuile cliquable, dans la même rangée que les vignettes existantes
        (même taille, même repère visuel qu'"ajouter un élément à une
        liste"), qui déclenche un input file cette fois-ci caché
        (`fileInputRef`).
      */}
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
        {urls.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex h-20 w-20 flex-col items-center justify-center gap-0.5 rounded-md border-2 border-dashed border-ligne text-encre/50 transition hover:border-cuivre-clair hover:text-cuivre-profond disabled:opacity-50"
          >
            <span className="text-xl leading-none">+</span>
            <span className="text-[10px] font-medium">Ajouter</span>
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleChange}
        disabled={uploading}
        className="hidden"
      />
      <p className="text-xs text-encre/50">
        Résolution entre 500×500 et 2000×2000 px, 2 Mo maximum par photo. Fond
        blanc recommandé, sans filigrane.
      </p>
      {uploading && <p className="text-xs text-encre/60">Envoi en cours...</p>}
      {error && <p className="text-xs text-erreur">{error}</p>}
    </div>
  );
}

/**
 * "Points forts" — liste à puces courtes mises en avant sur la fiche produit
 * (ex : "100% coton", "Garantie 12 mois"), demandé par Isaac le 22/09/2026
 * sur inspiration Jumia. Même logique d'ajout/suppression de ligne que
 * `VariantGroups` ci-dessous, plutôt qu'un champ texte unique séparé par
 * virgules comme `tags` : un point fort est une phrase courte, pas un
 * mot-clé, une virgule peut légitimement en faire partie.
 */
function HighlightsField({ initial }: { initial: string[] }) {
  const [items, setItems] = useState<string[]>(initial.length > 0 ? initial : [""]);

  function updateItem(index: number, value: string) {
    setItems((prev) => prev.map((v, i) => (i === index ? value : v)));
  }
  function addItem() {
    setItems((prev) => (prev.length >= MAX_HIGHLIGHTS ? prev : [...prev, ""]));
  }
  function removeItem(index: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  return (
    <fieldset className="flex flex-col gap-2 rounded-md border border-ligne p-3">
      <legend className="px-1 text-xs font-medium text-encre/60">
        Points forts <span className="text-encre/50">(optionnel)</span>
      </legend>
      <p className="text-xs text-encre/50">
        Ex : « 100% coton », « Garantie 12 mois », « Livré avec housse ».
      </p>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            value={item}
            onChange={(e) => updateItem(index, e.target.value)}
            placeholder="Ex : 100% coton"
            maxLength={120}
            className="flex-1 rounded-md border border-ligne px-3 py-1.5 text-sm"
          />
          {item.trim() && <input type="hidden" name="highlight" value={item.trim()} />}
          {items.length > 1 && (
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="text-xs text-erreur underline"
            >
              Retirer
            </button>
          )}
        </div>
      ))}
      {items.length < MAX_HIGHLIGHTS && (
        <button
          type="button"
          onClick={addItem}
          className="w-fit text-xs font-medium text-encre underline"
        >
          + Ajouter un point fort
        </button>
      )}
    </fieldset>
  );
}

/**
 * Groupes de variantes à nom libre (ex : "Taille", "Couleur", "Matière"...).
 *
 * Refondu le 22/09/2026 : chaque valeur d'un groupe était jusqu'ici un simple
 * mot dans une liste séparée par virgules ("S, M, L, XL"), ce qui ne laissait
 * aucune place pour un SKU/code-barres PAR VALEUR (demande d'Isaac,
 * inspiration Jumia — décision explicite de garder le modèle "groupe/valeur"
 * actuel plutôt que de vraies combinaisons SKU, voir migration 0031). Chaque
 * valeur est donc maintenant une ligne à part (valeur + SKU + code-barres,
 * ces deux derniers optionnels), au lieu d'un texte unique par groupe.
 */
function VariantGroups({ initialVariants }: { initialVariants: Variant[] }) {
  const [groups, setGroups] = useState<Group[]>(() => {
    const initial = groupsFromVariants(initialVariants);
    return initial.length > 0 ? initial : [{ name: "", rows: [{ value: "", sku: "", barcode: "" }] }];
  });

  function updateGroupName(index: number, name: string) {
    setGroups((prev) => prev.map((g, i) => (i === index ? { ...g, name } : g)));
  }
  function addGroup() {
    setGroups((prev) =>
      prev.length >= MAX_VARIANT_GROUPS
        ? prev
        : [...prev, { name: "", rows: [{ value: "", sku: "", barcode: "" }] }]
    );
  }
  function removeGroup(index: number) {
    setGroups((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  function updateRow(groupIndex: number, rowIndex: number, patch: Partial<VariantValueRow>) {
    setGroups((prev) =>
      prev.map((g, i) =>
        i === groupIndex
          ? { ...g, rows: g.rows.map((r, j) => (j === rowIndex ? { ...r, ...patch } : r)) }
          : g
      )
    );
  }
  function addRow(groupIndex: number) {
    setGroups((prev) =>
      prev.map((g, i) =>
        i === groupIndex && g.rows.length < MAX_VARIANT_VALUES_PER_GROUP
          ? { ...g, rows: [...g.rows, { value: "", sku: "", barcode: "" }] }
          : g
      )
    );
  }
  function removeRow(groupIndex: number, rowIndex: number) {
    setGroups((prev) =>
      prev.map((g, i) =>
        i === groupIndex && g.rows.length > 1
          ? { ...g, rows: g.rows.filter((_, j) => j !== rowIndex) }
          : g
      )
    );
  }

  return (
    <fieldset className="flex flex-col gap-3 rounded-md border border-ligne p-3">
      <legend className="px-1 text-xs font-medium text-encre/60">
        Variantes (optionnel)
      </legend>
      <p className="text-xs text-encre/50">
        Ex : un groupe « Taille » avec les valeurs « S », « M », « L »..., un
        groupe « Couleur » avec « Rouge », « Bleu »... Ajoute autant de groupes
        que nécessaire (Matière, Pointure...). Le client choisira une valeur
        par groupe. SKU/code-barres optionnels, par valeur.
      </p>
      {groups.map((group, groupIndex) => (
        <div key={groupIndex} className="flex flex-col gap-2 rounded border border-ligne p-2">
          <div className="flex items-center gap-2">
            <input
              value={group.name}
              onChange={(e) => updateGroupName(groupIndex, e.target.value)}
              placeholder="Nom du groupe (ex : Taille)"
              maxLength={40}
              className="flex-1 rounded-md border border-ligne px-3 py-1.5 text-sm"
            />
            {groups.length > 1 && (
              <button
                type="button"
                onClick={() => removeGroup(groupIndex)}
                className="text-xs text-erreur underline"
              >
                Retirer le groupe
              </button>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            {group.rows.map((row, rowIndex) => (
              <div key={rowIndex} className="flex flex-wrap items-center gap-1.5">
                <input
                  value={row.value}
                  onChange={(e) => updateRow(groupIndex, rowIndex, { value: e.target.value })}
                  placeholder="Valeur (ex : M)"
                  maxLength={60}
                  className="min-w-0 flex-1 basis-24 rounded-md border border-ligne px-2.5 py-1.5 text-sm"
                />
                <input
                  value={row.sku}
                  onChange={(e) => updateRow(groupIndex, rowIndex, { sku: e.target.value })}
                  placeholder="SKU (optionnel)"
                  maxLength={60}
                  className="min-w-0 flex-1 basis-24 rounded-md border border-ligne px-2.5 py-1.5 text-sm"
                />
                <input
                  value={row.barcode}
                  onChange={(e) => updateRow(groupIndex, rowIndex, { barcode: e.target.value })}
                  placeholder="Code-barres (optionnel)"
                  maxLength={60}
                  className="min-w-0 flex-1 basis-24 rounded-md border border-ligne px-2.5 py-1.5 text-sm"
                />
                {group.rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(groupIndex, rowIndex)}
                    className="text-xs text-erreur underline"
                  >
                    Retirer
                  </button>
                )}
                {/* Une ligne (groupe/valeur/sku/code-barres) par valeur non vide,
                    envoyée au serveur — voir actions.ts (variantRow*), qui
                    reconstruit les product_variants à partir de ces 4 tableaux
                    parallèles alignés par index (getAll() préserve l'ordre). */}
                {group.name.trim() && row.value.trim() && (
                  <>
                    <input type="hidden" name="variantRowName" value={group.name.trim()} />
                    <input type="hidden" name="variantRowValue" value={row.value.trim()} />
                    <input type="hidden" name="variantRowSku" value={row.sku.trim()} />
                    <input type="hidden" name="variantRowBarcode" value={row.barcode.trim()} />
                  </>
                )}
              </div>
            ))}
          </div>

          {group.rows.length < MAX_VARIANT_VALUES_PER_GROUP && (
            <button
              type="button"
              onClick={() => addRow(groupIndex)}
              className="w-fit text-xs font-medium text-encre underline"
            >
              + Ajouter une valeur
            </button>
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
 *
 * Lot "universel" ajouté le 22/09/2026 (Points forts, SKU/code-barres,
 * validation d'image, prix soldé daté) — voir migration
 * 0031_product_universal_features.sql pour le contexte complet de la
 * discussion avec Isaac.
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

      <HighlightsField initial={product?.highlights ?? []} />

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

      {/* Prix soldé daté — ajouté le 22/09/2026, distinct du prix barré
          permanent ci-dessus (voir migration 0031 pour le raisonnement
          complet). Actif uniquement pendant [saleStartsAt, saleEndsAt] —
          les deux dates sont optionnelles indépendamment l'une de l'autre
          (validé côté serveur, voir actions.ts). */}
      <fieldset className="flex flex-col gap-2 rounded-md border border-ligne p-3">
        <legend className="px-1 text-xs font-medium text-encre/60">
          Prix soldé (optionnel)
        </legend>
        <p className="text-xs text-encre/50">
          Prix affiché à la place du prix normal pendant une période donnée
          (ex : promo de weekend). Laisse vide pour ne pas faire de promo.
        </p>
        <div className="flex flex-col gap-1">
          <label htmlFor="salePrice" className="text-sm font-medium text-encre">
            Prix soldé (FCFA)
          </label>
          <input
            id="salePrice"
            name="salePrice"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            defaultValue={product?.sale_price ?? ""}
            className="rounded-md border border-ligne px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="saleStartsAt" className="text-sm font-medium text-encre">
              Début <span className="text-encre/50">(optionnel)</span>
            </label>
            <input
              id="saleStartsAt"
              name="saleStartsAt"
              type="datetime-local"
              defaultValue={toDatetimeLocalValue(product?.sale_starts_at)}
              className="rounded-md border border-ligne px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="saleEndsAt" className="text-sm font-medium text-encre">
              Fin <span className="text-encre/50">(optionnel)</span>
            </label>
            <input
              id="saleEndsAt"
              name="saleEndsAt"
              type="datetime-local"
              defaultValue={toDatetimeLocalValue(product?.sale_ends_at)}
              className="rounded-md border border-ligne px-3 py-2 text-sm"
            />
          </div>
        </div>
      </fieldset>

      {/* SKU/code-barres au niveau produit — surtout utile pour un produit
          SANS variante (sinon, un SKU/code-barres par valeur est disponible
          plus bas dans "Variantes"). */}
      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="sku" className="text-sm font-medium text-encre">
            SKU <span className="text-encre/50">(optionnel)</span>
          </label>
          <input
            id="sku"
            name="sku"
            defaultValue={product?.sku ?? ""}
            maxLength={60}
            placeholder="Ta référence interne"
            className="rounded-md border border-ligne px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="barcode" className="text-sm font-medium text-encre">
            Code-barres <span className="text-encre/50">(optionnel)</span>
          </label>
          <input
            id="barcode"
            name="barcode"
            defaultValue={product?.barcode ?? ""}
            maxLength={60}
            placeholder="EAN, UPC..."
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
