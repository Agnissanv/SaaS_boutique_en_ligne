import { createClient } from "./client";

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

const BUCKET = "shop-assets";
const MAX_FILE_SIZE_MB = 5;

export class ImageUploadError extends Error {}

function assertValidImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new ImageUploadError("Le fichier doit être une image (JPG, PNG, WebP...).");
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw new ImageUploadError(`Image trop lourde (max ${MAX_FILE_SIZE_MB} Mo).`);
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
  assertValidImage(file);

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
  const marker = `/object/public/${BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return;

  const path = decodeURIComponent(url.slice(index + marker.length));
  const supabase = createClient();
  await supabase.storage.from(BUCKET).remove([path]);
}
