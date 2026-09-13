"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils/slug";
import { isValidCategory } from "@/lib/categories";

export type ShopFormState = {
  error?: string;
  success?: boolean;
};

/**
 * Crée ou met à jour l'unique boutique du vendeur connecté.
 * (Le cahier des charges v1 prévoit une boutique par vendeur ; pas de
 * sélection de boutique_id ici.)
 */
export async function saveShop(
  _prevState: ShopFormState,
  formData: FormData
): Promise<ShopFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Session expirée, reconnecte-toi." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const shopId = String(formData.get("shopId") ?? "");
  // Renseignés côté client après upload direct vers Supabase Storage (voir
  // storage.ts) — chaîne vide si le vendeur n'a pas (encore) choisi d'image.
  const logoUrl = String(formData.get("logoUrl") ?? "").trim();
  const coverUrl = String(formData.get("coverUrl") ?? "").trim();

  if (!name || name.length < 2) {
    return { error: "Le nom de la boutique est trop court." };
  }
  if (description.length > 300) {
    return { error: "La description dépasse 300 caractères." };
  }
  if (!isValidCategory(category)) {
    return { error: "Choisis une catégorie valide." };
  }

  if (shopId) {
    // Mise à jour : on ne touche pas au slug pour ne pas casser le lien
    // déjà partagé par le vendeur.
    const { error } = await supabase
      .from("shops")
      .update({
        name,
        description: description || null,
        category,
        logo_url: logoUrl || null,
        cover_url: coverUrl || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", shopId)
      .eq("owner_id", user.id);

    if (error) {
      return { error: "Échec de la mise à jour. Réessaie." };
    }
  } else {
    // Création : génère un slug unique à partir du nom.
    const baseSlug = slugify(name) || "boutique";
    let slug = baseSlug;
    let attempt = 0;

    // Jusqu'à 5 tentatives pour trouver un slug libre (ex: "chez-awa-2").
    while (attempt < 5) {
      const { data: existing } = await supabase
        .from("shops")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (!existing) break;
      attempt += 1;
      slug = `${baseSlug}-${attempt + 1}`;
    }

    const { data: newShop, error } = await supabase
      .from("shops")
      .insert({
        owner_id: user.id,
        name,
        slug,
        description: description || null,
        category,
        logo_url: logoUrl || null,
        cover_url: coverUrl || null,
      })
      .select("id")
      .single();

    if (error) {
      return { error: "Échec de la création. Réessaie." };
    }

    // Démarre l'abonnement "Gratuit limité" par défaut (cf. cahier des
    // charges §3.1.A.7) : sans ça, la boutique n'aurait aucun abonnement du
    // tout tant que le paiement CinetPay n'est pas branché, et le
    // back-office admin n'aurait rien à afficher dans "Gestion des
    // abonnements". Non bloquant : une erreur ici n'empêche pas la création
    // de boutique (le vendeur peut continuer, un admin pourra assigner un
    // abonnement manuellement si besoin).
    if (newShop) {
      await supabase.rpc("start_free_subscription", { p_shop_id: newShop.id });
    }
  }

  revalidatePath("/dashboard/boutique");
  return { success: true };
}
