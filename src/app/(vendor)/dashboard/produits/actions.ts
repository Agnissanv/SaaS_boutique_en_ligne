"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils/slug";
import { getShopSubscription } from "@/lib/subscription";

export type ProductFormState = {
  error?: string;
  success?: boolean;
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
function parseVariantList(raw: FormDataEntryValue | null): string[] {
  if (!raw) return [];
  const values = String(raw)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return Array.from(new Set(values));
}

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
  const tailles = parseVariantList(formData.get("tailles"));
  const couleurs = parseVariantList(formData.get("couleurs"));
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
      })
      .select("id")
      .single();

    if (error || !inserted) {
      return { error: "Échec de la création. Réessaie." };
    }

    resolvedProductId = inserted.id;
  }

  // Variantes : approche simple "supprimer puis recréer" plutôt qu'un diff —
  // le volume par produit reste faible (tailles/couleurs). Le stock détaillé
  // par variante n'est pas encore géré : seul products.stock fait foi pour
  // l'instant (voir README).
  await supabase.from("product_variants").delete().eq("product_id", resolvedProductId);

  const variantRows = [
    ...tailles.map((value) => ({
      product_id: resolvedProductId,
      name: "Taille",
      value,
    })),
    ...couleurs.map((value) => ({
      product_id: resolvedProductId,
      name: "Couleur",
      value,
    })),
  ];

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
  return { success: true };
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

/** Suppression douce : le produit disparaît de la liste et de la boutique publique. */
export async function deleteProduct(productId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const shopId = await getOwnedShopId(supabase, user.id);
  if (!shopId) return;

  await supabase
    .from("products")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", productId)
    .eq("shop_id", shopId);

  revalidatePath("/dashboard/produits");
}
