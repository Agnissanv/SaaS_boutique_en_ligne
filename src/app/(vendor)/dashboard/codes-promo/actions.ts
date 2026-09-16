"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getShopSubscription } from "@/lib/subscription";

export type PromoCodeFormState = {
  error?: string;
};

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

/**
 * Codes promo — plan Pro uniquement (`can_use_promo_codes`, ajouté le
 * 16/09/2026). Revérifié ici côté serveur, même si la page masque déjà le
 * formulaire pour les autres plans (voir page.tsx) — même principe que
 * partout ailleurs dans le projet où une fonctionnalité est gated par plan.
 */
export async function createPromoCode(
  _prevState: PromoCodeFormState,
  formData: FormData
): Promise<PromoCodeFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Session expirée, reconnecte-toi." };
  }

  const shopId = await getOwnedShopId(supabase, user.id);
  if (!shopId) {
    return { error: "Crée d'abord ta boutique." };
  }

  const subscription = await getShopSubscription(supabase, shopId);
  if (!subscription.features.canUsePromoCodes) {
    return { error: "Les codes promo sont disponibles à partir du plan Pro." };
  }

  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const discountType = String(formData.get("discountType") ?? "");
  const discountValueRaw = String(formData.get("discountValue") ?? "").trim();
  const maxUsesRaw = String(formData.get("maxUses") ?? "").trim();
  const expiresAtRaw = String(formData.get("expiresAt") ?? "").trim();

  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) {
    return {
      error: "Le code doit faire 3 à 30 caractères : lettres, chiffres, - ou _.",
    };
  }
  if (discountType !== "percentage" && discountType !== "fixed") {
    return { error: "Type de réduction invalide." };
  }

  const discountValue = Number(discountValueRaw);
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    return { error: "La valeur de réduction doit être un nombre positif." };
  }
  if (discountType === "percentage" && discountValue > 100) {
    return { error: "Un pourcentage ne peut pas dépasser 100." };
  }

  let maxUses: number | null = null;
  if (maxUsesRaw) {
    maxUses = Number(maxUsesRaw);
    if (!Number.isInteger(maxUses) || maxUses <= 0) {
      return { error: "Le nombre d'utilisations max doit être un entier positif." };
    }
  }

  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null;

  const { error } = await supabase.from("promo_codes").insert({
    shop_id: shopId,
    code,
    discount_type: discountType,
    discount_value: discountValue,
    max_uses: maxUses,
    expires_at: expiresAt,
  });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ce code existe déjà pour ta boutique."
          : "Échec de la création. Réessaie.",
    };
  }

  revalidatePath("/dashboard/codes-promo");
  return {};
}

export async function togglePromoCodeActive(promoCodeId: string, nextActive: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const shopId = await getOwnedShopId(supabase, user.id);
  if (!shopId) return;

  // Gelé après downgrade depuis Pro (voir promo-code-list.tsx) — revérifié
  // ici, pas seulement caché côté UI.
  const subscription = await getShopSubscription(supabase, shopId);
  if (!subscription.features.canUsePromoCodes) return;

  await supabase
    .from("promo_codes")
    .update({ is_active: nextActive })
    .eq("id", promoCodeId)
    .eq("shop_id", shopId);

  revalidatePath("/dashboard/codes-promo");
}

export async function deletePromoCode(promoCodeId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const shopId = await getOwnedShopId(supabase, user.id);
  if (!shopId) return;

  const subscription = await getShopSubscription(supabase, shopId);
  if (!subscription.features.canUsePromoCodes) return;

  await supabase.from("promo_codes").delete().eq("id", promoCodeId).eq("shop_id", shopId);

  revalidatePath("/dashboard/codes-promo");
}
