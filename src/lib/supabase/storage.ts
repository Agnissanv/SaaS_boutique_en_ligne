import { createClient } from "./client";
import { SHOP_ASSETS_BUCKET, storagePathFromPublicUrl } from "./storage-path";

/**
 * Upload/suppression d'images dans le bucket public "shop-assets".
 *
 * Volontairement fait depuis le navigateur (pas via une Server Action) : le
 * fichier part directement vers Supabase Storage, sans passer par le corps
 * d'une requête Next.js. Ça évite la limite de taille des Server Actions
 * (1 Mo par défaut) et la limite de taille de requête des fonctions Vercel —
 * important pour des photos prises au téléphone. La sécurité est assurée par
 * les policies RLS sur `storage.objects` (voir 0003_storage.sql) : un
 * vendeur ne peut écrire que dans le dossier de sa propre boutique.
 */

const BUCKET = SHOP_ASSETS_BUCKET;
// Plafond du fichier ORIGINAL choisi par l'utilisateur, avant compression —
// large exprès (une photo prise directement au téléphone dépasse souvent
// 5 Mo sur un appareil récent) : le but n'est plus de rejeter ces photos
// mais de les compresser ci-dessous, voir `compressImage`. Ne bloque que les
// fichiers réellement excessifs, qui bloqueraient le navigateur à décoder.
const MAX_INPUT_SIZE_MB = 20;
// Plafond du fichier APRÈS compression — filet de sécurité seulement : avec
// le redimensionnement/la qualité ci-dessous, ce cas ne devrait
// pratiquement jamais se produire en pratique.
const MAX_OUTPUT_SIZE_MB = 5;
const MAX_DIMENSION_PX = 1600;
const OUTPUT_QUALITY = 0.82;

export class ImageUploadError extends Error {}

function assertValidImageType(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new ImageUploadError("Le fichier doit être une image (JPG, PNG, WebP...).");
  }
  if (file.size > MAX_INPUT_SIZE_MB * 1024 * 1024) {
    throw new ImageUploadError(`Image trop lourde (max ${MAX_INPUT_SIZE_MB} Mo).`);
  }
}

function assertValidOutputSize(file: File) {
  if (file.size > MAX_OUTPUT_SIZE_MB * 1024 * 1024) {
    throw new ImageUploadError(`Image trop lourde même après compression (max ${MAX_OUTPUT_SIZE_MB} Mo).`);
  }
}

/**
 * Compresse/redimensionne une image côté navigateur avant upload — ajouté le
 * 16/09/2026. Manquait depuis le début du projet (déjà noté "pas fait" dans
 * nos décisions techniques) : une vendeuse qui ajoute une photo produit
 * prise directement au téléphone (couramment 3-5 Mo, non compressée) faisait
 * charger sa boutique bien au-delà des "< 2,5 secondes sur 4G moyenne" visés
 * par le cahier des charges §4.1 — d'autant que les pages publiques
 * affichent ces photos en `<img>` brut, sans passer par un service
 * d'optimisation serveur.
 *
 * Redimensionne au maximum à `MAX_DIMENSION_PX` sur le plus grand côté
 * (largement suffisant pour un affichage web, jamais imprimé) et réencode en
 * WebP (`OUTPUT_QUALITY`) : gain habituel de 80-95% sur une photo de
 * téléphone, sans dégradation visible à l'écran. Ne bloque jamais l'upload
 * en cas d'échec (navigateur trop ancien pour `createImageBitmap`/l'encodage
 * WebP, image corrompue...) : on retombe alors sur le fichier original tel
 * quel plutôt que de faire échouer tout l'ajout de produit pour une
 * optimisation qui n'est qu'un bonus.
 */
async function compressImage(file: File): Promise<File> {
  // Repli : fichier déjà léger, la compression ne vaut pas le coût de
  // décodage/réencodage (icônes, captures déjà optimisées...).
  if (file.size < 300 * 1024) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION_PX / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", OUTPUT_QUALITY)
    );
    if (!blob || blob.size >= file.size) return file;

    const newName = `${file.name.replace(/\.[^.]+$/, "")}.webp`;
    return new File([blob], newName, { type: "image/webp" });
  } catch {
    return file;
  }
}

function extensionOf(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  // Fallback si le nom de fichier n'a pas d'extension exploitable.
  return file.type.split("/")[1] ?? "jpg";
}

/**
 * Upload une image dans le dossier de l'utilisateur connecté et renvoie son
 * URL publique.
 * @param subpath Sous-dossier, ex: "shop/logo", "shop/cover", ou "products/<uuid>"
 *
 * Le premier segment du chemin est l'id de l'utilisateur (pas celui de la
 * boutique/du produit, pas encore créés au moment de l'upload — voir
 * 0003_storage.sql pour la policy RLS correspondante).
 */
export async function uploadShopAssetImage(
  subpath: string,
  file: File
): Promise<{ url: string; path: string }> {
  assertValidImageType(file);
  const compressed = await compressImage(file);
  assertValidOutputSize(compressed);
  file = compressed;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ImageUploadError("Session expirée, reconnecte-toi.");
  }

  const path = `${user.id}/${subpath}/${crypto.randomUUID()}.${extensionOf(file)}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    throw new ImageUploadError(`Échec de l'upload : ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return { url: publicUrl, path };
}

/**
 * Supprime une image à partir de son URL publique (best-effort : les erreurs
 * sont avalées, un fichier orphelin dans le bucket n'est pas bloquant).
 */
export async function deleteShopAssetImageByUrl(url: string): Promise<void> {
  const path = storagePathFromPublicUrl(url);
  if (!path) return;

  const supabase = createClient();
  await supabase.storage.from(BUCKET).remove([path]);
}
