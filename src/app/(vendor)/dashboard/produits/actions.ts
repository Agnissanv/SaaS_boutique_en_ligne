"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils/slug";
import { getShopSubscription } from "@/lib/subscription";
import { SHOP_ASSETS_BUCKET, storagePathFromPublicUrl } from "@/lib/supabase/storage-path";

export type ProductFormState = {
  error?: string;
};

/**
 * Récupère l'id de la boutique du vendeur connecté, ou null.
 * Toutes les actions produit vérifient l'appartenance via cet id plutôt que
 * de faire confiance à une valeur envoyée par le formulaire.
 */
async function getOwnedShopId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data } = await supabase
    .from("shops")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();
  return data?.id as string | undefined;
}

/** "S, M , L" -> ["S", "M", "L"] (valeurs uniques, non vides) */
function parseCommaList(raw: FormDataEntryValue | string | null): string[] {
  if (!raw) return [];
  const values = String(raw)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return Array.from(new Set(values));
}

const MAX_VARIANT_GROUPS = 6;
const MAX_TAGS = 10;

export async function saveProduct(
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Session expirée, reconnecte-toi." };
  }

  const shopId = await getOwnedShopId(supabase, user.id);
  if (!shopId) {
    return { error: "Crée d'abord ta boutique avant d'ajouter un produit." };
  }

  const productId = String(formData.get("productId") ?? "");

  // Blocage progressif d'abonnement expiré (§3.1.A.7, cf. src/lib/subscription.ts) :
  // seule la CRÉATION d'un nouveau produit est bloquée une fois la période de
  // grâce dépassée — modifier/désactiver/supprimer un produit existant, gérer
  // les commandes en cours, etc. restent possibles ("boutique figée", pas
  // coupée). Revérifié ici côté serveur, pas seulement caché côté UI, comme
  // pour les autres contrôles d'accès du projet.
  if (!productId) {
    const subscription = await getShopSubscription(supabase, shopId);
    if (subscription.state === "expired") {
      return {
        error:
          "Ton abonnement est expiré : impossible d'ajouter un nouveau produit tant qu'il n'est pas renouvelé. Contacte-nous pour le renouveler.",
      };
    }
  }
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "");
  const compareAtRaw = String(formData.get("compareAtPrice") ?? "").trim();
  const stockRaw = String(formData.get("stock") ?? "0");
  const tags = parseCommaList(formData.get("tags"))
    .map((t) => t.toLowerCase())
    .slice(0, MAX_TAGS);
  // Groupes de variantes à nom libre (ex : "Taille", "Couleur", "Matière"...)
  // — un couple nom/valeurs par groupe non vide, envoyés en parallèle par
  // VariantGroups (product-form.tsx). getAll() préserve l'ordre d'apparition
  // dans le DOM, donc les deux tableaux restent alignés par index.
  const variantGroupNames = formData
    .getAll("variantGroupName")
    .map((v) => String(v).trim())
    .slice(0, MAX_VARIANT_GROUPS);
  const variantGroupValues = formData.getAll("variantGroupValues").map((v) => String(v));
  // Renseignées côté client après upload direct vers Supabase Storage (voir
  // storage.ts) : une valeur par image conservée, dans l'ordre d'affichage.
  const imageUrls = formData
    .getAll("imageUrls")
    .map((v) => String(v).trim())
    .filter(Boolean)
    .slice(0, 6);

  if (!title || title.length < 2) {
    return { error: "Le titre du produit est trop court." };
  }

  const price = Number(priceRaw);
  if (!Number.isFinite(price) || price < 0) {
    return { error: "Le prix doit être un nombre positif." };
  }

  let compareAtPrice: number | null = null;
  if (compareAtRaw) {
    compareAtPrice = Number(compareAtRaw);
    if (!Number.isFinite(compareAtPrice) || compareAtPrice < 0) {
      return { error: "Le prix barré doit être un nombre positif." };
    }
  }

  const stock = Number(stockRaw);
  if (!Number.isInteger(stock) || stock < 0) {
    return { error: "Le stock doit être un nombre entier positif." };
  }

  let resolvedProductId = productId;

  if (productId) {
    // Mise à jour — le slug n'est pas régénéré pour ne pas casser un lien
    // déjà partagé par le vendeur.
    const { error } = await supabase
      .from("products")
      .update({
        title,
        description: description || null,
        category: category || null,
        price,
        compare_at_price: compareAtPrice,
        stock,
        tags,
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId)
      .eq("shop_id", shopId);

    if (error) {
      return { error: "Échec de la mise à jour. Réessaie." };
    }
  } else {
    // Création : slug unique au sein de la boutique (contrainte unique(shop_id, slug)).
    const baseSlug = slugify(title) || "produit";
    let slug = baseSlug;
    let attempt = 0;

    while (attempt < 5) {
      const { data: existing } = await supabase
        .from("products")
        .select("id")
        .eq("shop_id", shopId)
        .eq("slug", slug)
        .maybeSingle();

      if (!existing) break;
      attempt += 1;
      slug = `${baseSlug}-${attempt + 1}`;
    }

    const { data: inserted, error } = await supabase
      .from("products")
      .insert({
        shop_id: shopId,
        slug,
        title,
        description: description || null,
        category: category || null,
        price,
        compare_at_price: compareAtPrice,
        stock,
        tags,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      return { error: "Échec de la création. Réessaie." };
    }

    resolvedProductId = inserted.id;
  }

  // Variantes : approche simple "supprimer puis recréer" plutôt qu'un diff —
  // le volume par produit reste faible. Groupes à nom libre depuis le
  // 13/09/2026 (voir VariantGroups dans product-form.tsx) : plus seulement
  // "Taille"/"Couleur" figés. Le stock détaillé par variante n'est toujours
  // pas géré : seul products.stock fait foi pour l'instant (voir README).
  await supabase.from("product_variants").delete().eq("product_id", resolvedProductId);

  const variantRows = variantGroupNames.flatMap((name, index) => {
    if (!name) return [];
    const values = parseCommaList(variantGroupValues[index] ?? null);
    return values.map((value) => ({
      product_id: resolvedProductId,
      name,
      value,
    }));
  });

  if (variantRows.length > 0) {
    await supabase.from("product_variants").insert(variantRows);
  }

  // Photos : même approche "supprimer puis recréer" que les variantes — la
  // liste envoyée par le formulaire est déjà la liste finale voulue (photos
  // conservées + nouvelles), dans l'ordre d'affichage souhaité.
  await supabase.from("product_images").delete().eq("product_id", resolvedProductId);

  if (imageUrls.length > 0) {
    await supabase.from("product_images").insert(
      imageUrls.map((url, position) => ({
        product_id: resolvedProductId,
        url,
        position,
      }))
    );
  }

  revalidatePath("/dashboard/produits");
  // Redirection vers la liste plutôt que de rester sur le formulaire —
  // signalé par Isaac le 13/09/2026 : un vendeur qui reste sur l'écran de
  // remplissage après avoir enregistré peut croire que rien ne s'est passé,
  // même avec un message "Produit enregistré" affiché. Revoir son produit
  // apparaître dans la liste est une confirmation beaucoup plus claire.
  redirect("/dashboard/produits");
}

/** Active/désactive un produit (retiré de la boutique publique sans le supprimer). */
export async function toggleProductActive(productId: string, nextActive: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const shopId = await getOwnedShopId(supabase, user.id);
  if (!shopId) return;

  await supabase
    .from("products")
    .update({ is_active: nextActive, updated_at: new Date().toISOString() })
    .eq("id", productId)
    .eq("shop_id", shopId);

  revalidatePath("/dashboard/produits");
}

/**
 * Active/désactive plusieurs produits d'un coup — ajouté le 15/09/2026 en
 * réponse au mandat d'Isaac ("essentiel pour concurrencer") : un vendeur
 * avec un large catalogue (ex : fin de collection, rupture fournisseur
 * généralisée) devait jusqu'ici cliquer "Désactiver" produit par produit.
 * `.in("id", productIds)` combiné à `.eq("shop_id", shopId)` : même garantie
 * de propriété que les actions unitaires, même en cas d'id trafiqué côté
 * client (un id qui n'appartient pas à ce vendeur est simplement ignoré,
 * pas d'erreur).
 */
export async function bulkToggleActive(productIds: string[], nextActive: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const shopId = await getOwnedShopId(supabase, user.id);
  if (!shopId || productIds.length === 0) return;

  await supabase
    .from("products")
    .update({ is_active: nextActive, updated_at: new Date().toISOString() })
    .in("id", productIds)
    .eq("shop_id", shopId);

  revalidatePath("/dashboard/produits");
}

/**
 * Supprime les photos Storage d'un produit (best-effort) et leurs lignes
 * `product_images` — appelé juste après une suppression de produit, pour ne
 * pas laisser trainer indéfiniment des fichiers qui ne seront plus jamais
 * affichés (question posée par Isaac le 13/09/2026 : les photos restaient
 * en Storage après suppression d'un produit, gaspillant de l'espace pour
 * rien). Best-effort côté Storage : si la suppression échoue (réseau, etc.),
 * on continue quand même — un fichier orphelin dans le bucket n'est pas
 * bloquant, contrairement à un produit qui resterait mal supprimé.
 */
async function deleteProductAssets(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string
) {
  const { data: images } = await supabase
    .from("product_images")
    .select("url")
    .eq("product_id", productId);

  const paths = (images ?? [])
    .map((img) => storagePathFromPublicUrl(img.url))
    .filter((path): path is string => Boolean(path));

  if (paths.length > 0) {
    await supabase.storage.from(SHOP_ASSETS_BUCKET).remove(paths);
  }

  await supabase.from("product_images").delete().eq("product_id", productId);
}

/**
 * Suppression douce : le produit disparaît de la liste et de la boutique
 * publique (`deleted_at`, pas de fonctionnalité de restauration dans
 * l'app — voir `dashboard/produits/page.tsx`, qui filtre définitivement les
 * produits supprimés). Comme un produit supprimé ne redevient jamais
 * visible, ses photos sont nettoyées de Storage au même moment plutôt que
 * gardées indéfiniment.
 */
export async function deleteProduct(productId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const shopId = await getOwnedShopId(supabase, user.id);
  if (!shopId) return;

  const { data: updated } = await supabase
    .from("products")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", productId)
    .eq("shop_id", shopId)
    .select("id")
    .maybeSingle();

  // Aucune ligne touchée (produit inexistant ou d'une autre boutique) :
  // rien à nettoyer.
  if (updated) {
    await deleteProductAssets(supabase, productId);
  }

  revalidatePath("/dashboard/produits");
}
