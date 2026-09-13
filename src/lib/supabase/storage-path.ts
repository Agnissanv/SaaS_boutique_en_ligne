/**
 * Conversion URL publique <-> chemin Storage pour le bucket "shop-assets".
 * Extrait dans son propre fichier (13/09/2026) pour être réutilisable aussi
 * bien côté navigateur (`storage.ts`, suppression d'une photo pendant
 * l'édition du formulaire) que côté serveur (Server Actions, nettoyage des
 * photos d'un produit supprimé) — les deux ont besoin de la même logique de
 * parsing d'URL, sans dépendre d'un client Supabase particulier.
 */

export const SHOP_ASSETS_BUCKET = "shop-assets";

/**
 * Chemin Storage relatif à partir d'une URL publique du bucket
 * "shop-assets", ou `null` si l'URL ne correspond pas à ce bucket (garde-fou :
 * ne jamais tenter de supprimer un chemin construit à partir d'une URL
 * inattendue).
 */
export function storagePathFromPublicUrl(url: string): string | null {
  const marker = `/object/public/${SHOP_ASSETS_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
}
