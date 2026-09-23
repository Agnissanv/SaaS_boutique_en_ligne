"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils/slug";
import { isValidCategory } from "@/lib/categories";
import { getShopSubscription } from "@/lib/subscription";

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

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
  const accentColorRaw = String(formData.get("accentColor") ?? "").trim();
  // Frais de livraison : optionnel, null si laissé vide (le client verra
  // alors "à confirmer avec le vendeur" — voir migration 0012).
  const deliveryFeeRaw = String(formData.get("deliveryFee") ?? "").trim();
  // Contact WhatsApp + email de notification — ajoutés le 15/09/2026 (voir
  // migration 0013). Tous deux optionnels, aucune validation de format
  // stricte : un numéro WhatsApp peut avoir des formats variés selon le
  // pays, et une adresse mal formée échouera simplement silencieusement à
  // l'envoi plutôt que de bloquer l'enregistrement de la boutique.
  const whatsappNumber = String(formData.get("whatsappNumber") ?? "").trim();
  const notificationEmail = String(formData.get("notificationEmail") ?? "").trim();

  if (!name || name.length < 2) {
    return { error: "Le nom de la boutique est trop court." };
  }
  if (description.length > 300) {
    return { error: "La description dépasse 300 caractères." };
  }
  if (!isValidCategory(category)) {
    return { error: "Choisis une catégorie valide." };
  }

  let deliveryFee: number | null = null;
  if (deliveryFeeRaw) {
    deliveryFee = Number(deliveryFeeRaw);
    if (!Number.isFinite(deliveryFee) || deliveryFee < 0) {
      return { error: "Le frais de livraison doit être un nombre positif." };
    }
  }

  if (shopId) {
    // Personnalisation de la marque — plan Business ("basic" : logo) ou Pro
    // ("complete" : logo + couleur d'accent), ajouté le 16/09/2026. `logo_url`
    // existait déjà en base et était modifiable par tous les plans jusqu'ici
    // (jamais vérifié nulle part) — désormais revérifié ici côté serveur,
    // même si le champ est masqué côté UI (shop-form.tsx) pour Starter.
    // Un vendeur qui downgrade ne voit pas son logo/couleur existants
    // effacés au prochain enregistrement d'un champ sans rapport (nom,
    // description...) : ils restent en base, gelés, comme pour les variantes
    // produit — le champ correspondant est simplement omis de l'`update`
    // plutôt que forcé à `null`.
    const subscription = await getShopSubscription(supabase, shopId);
    const canCustomizeBranding = subscription.features.canCustomizeBranding;

    let accentColor: string | null | undefined;
    if (canCustomizeBranding === "complete") {
      if (accentColorRaw && !HEX_COLOR_RE.test(accentColorRaw)) {
        return { error: "Couleur d'accent invalide." };
      }
      accentColor = accentColorRaw || null;
    }

    // Mise à jour : on ne touche pas au slug pour ne pas casser le lien
    // déjà partagé par le vendeur.
    const { error } = await supabase
      .from("shops")
      .update({
        name,
        description: description || null,
        category,
        ...(canCustomizeBranding !== "none" ? { logo_url: logoUrl || null } : {}),
        cover_url: coverUrl || null,
        ...(accentColor !== undefined ? { accent_color: accentColor } : {}),
        delivery_fee: deliveryFee,
        whatsapp_number: whatsappNumber || null,
        notification_email: notificationEmail || null,
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

    // Une boutique qui vient d'être créée n'a pas encore d'abonnement
    // (démarré juste après, via start_free_subscription plus bas) : son plan
    // est donc toujours équivalent Starter au moment de cette création, qui
    // n'a pas de logo/couleur d'accent — cohérent avec canCustomizeBranding
    // === "none" pour Starter. Le vendeur les ajoutera après upgrade, depuis
    // "Ma boutique".
    const { data: newShop, error } = await supabase
      .from("shops")
      .insert({
        owner_id: user.id,
        name,
        slug,
        description: description || null,
        category,
        cover_url: coverUrl || null,
        delivery_fee: deliveryFee,
        whatsapp_number: whatsappNumber || null,
        notification_email: notificationEmail || null,
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

      // Système de parrainage (23/09/2026, voir decisions-techniques.md et
      // supabase/migrations/0045_referral_system.sql) : `referred_by_code`
      // a été capturé à l'inscription (formulaire email/mot de passe ou
      // `?ref=` via Google, voir inscription-form.tsx et
      // auth/callback/route.ts) et dort sur le profil jusqu'à ce que ce
      // vendeur crée enfin sa boutique — seul moment où on a un
      // `referred_shop_id` à enregistrer. `create_referral()` (RPC
      // `security definer`) revalide tout elle-même (slug existant,
      // boutique active, pas d'auto-parrainage) et ne fait rien en silence
      // si le code est invalide ou périmé — non bloquant, même principe que
      // `start_free_subscription` juste au-dessus : une erreur ici
      // n'empêche jamais la création de boutique.
      const { data: profile } = await supabase
        .from("profiles")
        .select("referred_by_code, referred_by_agent_code")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.referred_by_code) {
        await supabase.rpc("create_referral", {
          p_referred_shop_id: newShop.id,
          p_referrer_slug: profile.referred_by_code,
        });
      }

      // Parrainage COMMERCIAL (23/09/2026, voir decisions-techniques.md et
      // supabase/migrations/0046_commercial_referral_system.sql) — canal
      // totalement séparé du parrainage vendeur ci-dessus (`?agent=` plutôt
      // que `?ref=`, capturé dans `referred_by_agent_code`) : un vendeur
      // recruté par un commercial reste indépendant du système entre
      // vendeurs, jamais les deux mélangés. Même philosophie "non
      // bloquant" que `create_referral` juste au-dessus.
      if (profile?.referred_by_agent_code) {
        await supabase.rpc("create_commercial_referral", {
          p_referred_shop_id: newShop.id,
          p_agent_code: profile.referred_by_agent_code,
        });
      }
    }
  }

  revalidatePath("/dashboard/boutique");
  return { success: true };
}

/**
 * Accepte une invitation de collaborateur (plan Pro, `can_multi_user`,
 * ajoutée le 16/09/2026 — voir accept_shop_collaboration dans la migration
 * 0024 et le raisonnement complet dans src/lib/shop-access.ts). Passe par
 * une RPC `security definer` plutôt qu'un UPDATE direct : elle matche
 * l'email du compte connecté à `invited_email` elle-même, donc rien à
 * vérifier ici avant l'appel — l'affichage du bouton (boutique/page.tsx)
 * suffit à garantir qu'on ne l'appelle que pour une vraie invitation en
 * attente, et la RPC re-vérifie de toute façon côté serveur.
 */
export async function acceptCollaboratorInvite(formData: FormData) {
  const shopId = String(formData.get("shopId") ?? "");
  if (!shopId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.rpc("accept_shop_collaboration", {
    p_shop_id: shopId,
  });

  if (error) {
    console.error("acceptCollaboratorInvite — erreur Supabase:", error);
    return;
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
