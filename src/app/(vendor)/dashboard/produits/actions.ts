"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils/slug";
import { getShopSubscription } from "@/lib/subscription";
import { getAccessibleShop } from "@/lib/shop-access";
import { SHOP_ASSETS_BUCKET, storagePathFromPublicUrl } from "@/lib/supabase/storage-path";

export type ProductFormState = {
  error?: string;
};

/**
 * Récupère l'id de la boutique gérable par l'utilisateur connecté (sa
 * boutique en tant que propriétaire, ou celle d'un collaborateur actif —
 * plan Pro, ajouté le 16/09/2026, voir src/lib/shop-access.ts), ou
 * `undefined`. Toutes les actions produit vérifient l'appartenance/l'accès
 * via cet id plutôt que de faire confiance à une valeur envoyée par le
 * formulaire.
 */
async function getOwnedShopId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const access = await getAccessibleShop(supabase, userId);
  return access?.shopId;
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
const MAX_VARIANT_VALUES_PER_GROUP = 20;
const MAX_VARIANT_ROWS = MAX_VARIANT_GROUPS * MAX_VARIANT_VALUES_PER_GROUP;
const MAX_TAGS = 10;
const MAX_HIGHLIGHTS = 10;

/**
 * "2026-09-22T14:30" (valeur brute d'un <input type="datetime-local">) ->
 * ISO 8601, ou `{valid: false}` si le texte n'est pas une date exploitable.
 * Champ vide -> `{valid: true, value: null}` (date optionnelle non
 * renseignée, pas une erreur).
 */
function parseOptionalDatetimeLocal(raw: string): { valid: boolean; value: string | null } {
  if (!raw) return { valid: true, value: null };
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return { valid: false, value: null };
  return { valid: true, value: parsed.toISOString() };
}

/**
 * Stock "effectivement illimité" appliqué aux produits d'un plan sans
 * `can_manage_stock` (Starter, cf. plus bas) — voir le commentaire sur son
 * usage pour le raisonnement complet.
 */
const UNLIMITED_STOCK_SENTINEL = 999_999;

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

  // Abonnement récupéré une seule fois, réutilisé pour tous les contrôles liés
  // au plan ci-dessous (expiration, limite de produits, gestion du stock,
  // variantes) — refonte des abonnements du 15/09/2026 (spec finale d'Isaac,
  // voir supabase/migrations/0016_subscription_plans_v2.sql).
  const subscription = await getShopSubscription(supabase, shopId);

  // Blocage progressif d'abonnement expiré (§3.1.A.7, cf. src/lib/subscription.ts) :
  // seule la CRÉATION d'un nouveau produit est bloquée une fois la période de
  // grâce dépassée — modifier/désactiver/supprimer un produit existant, gérer
  // les commandes en cours, etc. restent possibles ("boutique figée", pas
  // coupée). Revérifié ici côté serveur, pas seulement caché côté UI, comme
  // pour les autres contrôles d'accès du projet.
  if (!productId) {
    if (subscription.state === "expired") {
      return {
        error:
          "Ton abonnement est expiré : impossible d'ajouter un nouveau produit tant qu'il n'est pas renouvelé. Contacte-nous pour le renouveler.",
      };
    }

    // Limite de produits par plan (§2 de la spec d'Isaac, 15/09/2026) —
    // jusqu'ici en base (`features.max_products`) mais jamais vérifiée nulle
    // part, malgré plusieurs mentions "non fait" dans decisions-techniques.md.
    // `null` = illimité (plan Pro). Compte les produits non supprimés
    // (actifs ou désactivés) : un vendeur ne doit pas pouvoir contourner la
    // limite en désactivant puis recréant, la désactivation reste réversible.
    const maxProducts = subscription.features.maxProducts;
    if (maxProducts !== null) {
      const { count } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", shopId)
        .is("deleted_at", null);

      if ((count ?? 0) >= maxProducts) {
        return {
          error: `Limite de ${maxProducts} produits atteinte pour ton plan ${subscription.planName ?? "actuel"}. Passe à un plan supérieur pour ajouter plus de produits.`,
        };
      }
    }
  }
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "");
  const compareAtRaw = String(formData.get("compareAtPrice") ?? "").trim();
  const stockRaw = String(formData.get("stock") ?? "0");
  const stockAlertThresholdRaw = String(formData.get("stockAlertThreshold") ?? "").trim();
  const tags = parseCommaList(formData.get("tags"))
    .map((t) => t.toLowerCase())
    .slice(0, MAX_TAGS);
  // "Points forts" — ajouté le 22/09/2026 (migration 0031). Une entrée
  // <input type="hidden" name="highlight"> par point non vide, voir
  // HighlightsField (product-form.tsx).
  const highlights = formData
    .getAll("highlight")
    .map((v) => String(v).trim())
    .filter(Boolean)
    .slice(0, MAX_HIGHLIGHTS);
  // Groupes de variantes à nom libre (ex : "Taille", "Couleur", "Matière"...)
  // — refondu le 22/09/2026 (migration 0031) : chaque VALEUR d'un groupe est
  // maintenant sa propre ligne (avec SKU/code-barres optionnels), plutôt
  // qu'un texte unique séparé par virgules. VariantGroups (product-form.tsx)
  // envoie 4 tableaux parallèles alignés par index (une ligne = un index dans
  // chacun) — getAll() préserve l'ordre d'apparition dans le DOM.
  const variantRowNames = formData
    .getAll("variantRowName")
    .map((v) => String(v).trim())
    .slice(0, MAX_VARIANT_ROWS);
  const variantRowValues = formData
    .getAll("variantRowValue")
    .map((v) => String(v).trim())
    .slice(0, MAX_VARIANT_ROWS);
  const variantRowSkus = formData
    .getAll("variantRowSku")
    .map((v) => String(v).trim())
    .slice(0, MAX_VARIANT_ROWS);
  const variantRowBarcodes = formData
    .getAll("variantRowBarcode")
    .map((v) => String(v).trim())
    .slice(0, MAX_VARIANT_ROWS);
  const sku = String(formData.get("sku") ?? "").trim() || null;
  const barcode = String(formData.get("barcode") ?? "").trim() || null;
  const salePriceRaw = String(formData.get("salePrice") ?? "").trim();
  const saleStartsAtRaw = String(formData.get("saleStartsAt") ?? "").trim();
  const saleEndsAtRaw = String(formData.get("saleEndsAt") ?? "").trim();
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

  // Prix soldé daté — ajouté le 22/09/2026 (migration 0031). Les deux dates
  // restent optionnelles indépendamment l'une de l'autre (une promo peut
  // n'avoir qu'une date de fin, ou aucune des deux si le vendeur veut
  // l'activer immédiatement sans limite) — seule leur COHÉRENCE entre elles
  // est vérifiée ici, la contrainte définitive restant en base
  // (`products_sale_window_order`).
  let salePrice: number | null = null;
  if (salePriceRaw) {
    salePrice = Number(salePriceRaw);
    if (!Number.isFinite(salePrice) || salePrice < 0) {
      return { error: "Le prix soldé doit être un nombre positif." };
    }
    if (salePrice >= price) {
      return { error: "Le prix soldé doit être inférieur au prix normal." };
    }
  }

  const saleStarts = parseOptionalDatetimeLocal(saleStartsAtRaw);
  if (!saleStarts.valid) {
    return { error: "Date de début de promo invalide." };
  }
  const saleEnds = parseOptionalDatetimeLocal(saleEndsAtRaw);
  if (!saleEnds.valid) {
    return { error: "Date de fin de promo invalide." };
  }
  if (saleStarts.value && saleEnds.value && new Date(saleEnds.value) <= new Date(saleStarts.value)) {
    return { error: "La date de fin de la promo doit être après la date de début." };
  }
  if (salePrice == null && (saleStarts.value || saleEnds.value)) {
    return { error: "Renseigne un prix soldé pour activer la promo, ou laisse les dates vides." };
  }

  let stock = Number(stockRaw);
  if (!Number.isInteger(stock) || stock < 0) {
    return { error: "Le stock doit être un nombre entier positif." };
  }

  // Plan Starter : pas de gestion de stock (spec du 15/09/2026, confirmée
  // explicitement par Isaac malgré le fait que stock/variantes étaient
  // universels jusqu'ici). Le champ reste masqué côté UI (product-form.tsx),
  // mais revérifié ici côté serveur — un vendeur Starter ne doit surtout pas
  // se retrouver bloqué à la vente faute de stock : `create_order` refuse
  // toute commande si `stock < quantité commandée` (0004_orders_rpc.sql et
  // versions suivantes), donc plutôt que de laisser le défaut de colonne à 0
  // (ce qui empêcherait purement et simplement toute vente), le stock est
  // forcé à une valeur volontairement très haute — équivalent fonctionnel
  // d'un stock illimité, sans toucher à la RPC de commande elle-même.
  if (!subscription.features.canManageStock) {
    stock = UNLIMITED_STOCK_SENTINEL;
  }

  // Seuil d'alerte personnalisable par produit — plan Pro uniquement
  // (`has_advanced_stock_alerts`, ajouté le 16/09/2026). Le champ est masqué
  // côté UI (product-form.tsx) pour les autres plans, mais revérifié ici
  // côté serveur, même principe que canManageStock/canUseVariants juste
  // au-dessus : `null` retombe sur LOW_STOCK_THRESHOLD (src/lib/products.ts).
  let stockAlertThreshold: number | null = null;
  if (subscription.features.hasAdvancedStockAlerts && stockAlertThresholdRaw) {
    const parsed = Number(stockAlertThresholdRaw);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return { error: "Le seuil d'alerte doit être un nombre entier positif." };
    }
    stockAlertThreshold = parsed;
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
        stock_alert_threshold: stockAlertThreshold,
        tags,
        highlights,
        sku,
        barcode,
        sale_price: salePrice,
        sale_starts_at: saleStarts.value,
        sale_ends_at: saleEnds.value,
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId)
      .eq("shop_id", shopId);

    if (error) {
      console.error("saveProduct (update) — erreur Supabase:", error);
      return { error: "Échec de la mise à jour. Réessaie." };
    }
  } else {
    // Slug unique au sein de la boutique (contrainte unique(shop_id, slug)).
    // 5 essais séquentiels lisibles (-2, -3...) d'abord, puis un suffixe
    // aléatoire si ça ne suffit pas : la suppression de produit est "douce"
    // (deleted_at, pas une vraie suppression — voir deleteProductAssets plus
    // bas), donc les slugs de produits de test supprimés restent occupés au
    // niveau de la contrainte. Un vendeur qui recrée plusieurs fois un
    // produit du même nom en testant peut ainsi épuiser les 5 essais
    // séquentiels — bug trouvé le 15/09/2026 (Isaac bloqué en boucle sur
    // "Échec de la création", root cause confirmée via les logs Vercel :
    // 23505 duplicate key sur products_shop_id_slug_key).
    // Champs partagés par les deux tentatives d'insertion ci-dessous (essai
    // normal + retry après collision de slug) — un seul endroit à mettre à
    // jour si un champ produit change, plutôt que deux objets dupliqués qui
    // peuvent diverger avec le temps.
    const baseProductFields = {
      title,
      description: description || null,
      category: category || null,
      price,
      compare_at_price: compareAtPrice,
      stock,
      stock_alert_threshold: stockAlertThreshold,
      tags,
      highlights,
      sku,
      barcode,
      sale_price: salePrice,
      sale_starts_at: saleStarts.value,
      sale_ends_at: saleEnds.value,
    };

    const baseSlug = slugify(title) || "produit";
    let slug = baseSlug;
    let attempt = 0;

    while (attempt < 8) {
      const { data: existing } = await supabase
        .from("products")
        .select("id")
        .eq("shop_id", shopId)
        .eq("slug", slug)
        .maybeSingle();

      if (!existing) break;
      attempt += 1;
      slug =
        attempt <= 5
          ? `${baseSlug}-${attempt + 1}`
          : `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
    }

    let { data: inserted, error } = await supabase
      .from("products")
      .insert({
        shop_id: shopId,
        slug,
        ...baseProductFields,
      })
      .select("id")
      .single();

    // Filet de sécurité : même après la boucle ci-dessus, une vraie collision
    // de dernière minute (23505) ne doit pas bloquer le vendeur — un seul
    // retry avec un suffixe aléatoire suffit, la probabilité d'une deuxième
    // collision est négligeable.
    if (error?.code === "23505") {
      slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
      ({ data: inserted, error } = await supabase
        .from("products")
        .insert({
          shop_id: shopId,
          slug,
          ...baseProductFields,
        })
        .select("id")
        .single());
    }

    if (error || !inserted) {
      console.error("saveProduct (création) — erreur Supabase:", error);
      return { error: "Échec de la création. Réessaie." };
    }

    resolvedProductId = inserted.id;
  }

  // Variantes : approche simple "supprimer puis recréer" plutôt qu'un diff —
  // le volume par produit reste faible. Groupes à nom libre depuis le
  // 13/09/2026 (voir VariantGroups dans product-form.tsx). Chaque VALEUR est
  // sa propre ligne depuis le 22/09/2026 (migration 0031), avec SKU/code-barres
  // optionnels — 4 tableaux parallèles (variantRow*) alignés par index, un
  // index = une ligne. Le stock détaillé par variante n'est toujours pas géré :
  // seul products.stock fait foi pour l'instant (voir README).
  //
  // Plan Starter : pas de variantes (spec du 15/09/2026). Le champ est masqué
  // côté UI, donc `variantRowNames` arrive déjà vide en pratique — mais on
  // n'exécute même pas le "supprimer puis recréer" dans ce cas, plutôt que de
  // forcer une liste vide : un vendeur qui downgrade de Business à Starter ne
  // doit pas voir ses variantes existantes silencieusement effacées à la
  // prochaine modification d'un champ sans rapport (prix, description...).
  // Ses variantes restent en base, gelées, jusqu'à ce qu'il remonte de plan.
  if (subscription.features.canUseVariants) {
    await supabase.from("product_variants").delete().eq("product_id", resolvedProductId);

    const variantRows = variantRowNames.flatMap((name, index) => {
      const value = variantRowValues[index];
      if (!name || !value) return [];
      return [
        {
          product_id: resolvedProductId,
          name,
          value,
          sku: variantRowSkus[index] || null,
          barcode: variantRowBarcodes[index] || null,
        },
      ];
    });

    if (variantRows.length > 0) {
      await supabase.from("product_variants").insert(variantRows);
    }
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
