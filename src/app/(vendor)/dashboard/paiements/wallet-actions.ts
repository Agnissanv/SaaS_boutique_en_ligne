"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type RequestWithdrawalState = {
  error?: string;
  success?: boolean;
};

const PAYOUT_METHODS = ["wave", "orange_money", "mtn_momo", "moov"] as const;

/**
 * Demande de retrait du portefeuille vendeur (29/09/2026 — voir
 * decisions-techniques.md et supabase/migrations/0047_...). Toute la
 * validation réelle (propriété de la boutique via `auth.uid()`, solde
 * suffisant, minimum de 1000 FCFA) vit dans la RPC `request_vendor_withdrawal`
 * (`security definer`) — cette action ne fait que relayer l'appel via le
 * client AUTHENTIFIÉ (jamais le service role : c'est justement `auth.uid()`
 * à l'intérieur de la RPC qui doit correspondre au propriétaire de la
 * boutique) et traduire une erreur Postgres brute en message affichable.
 */
export async function requestWithdrawal(
  shopId: string,
  _prevState: RequestWithdrawalState,
  formData: FormData
): Promise<RequestWithdrawalState> {
  const supabase = await createClient();

  const amount = Number(formData.get("amount"));
  const payoutPhone = String(formData.get("payoutPhone") ?? "").trim();
  const payoutMethod = String(formData.get("payoutMethod") ?? "");

  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Montant invalide." };
  }
  if (!payoutPhone) {
    return { error: "Numéro de réception requis." };
  }
  if (!PAYOUT_METHODS.includes(payoutMethod as (typeof PAYOUT_METHODS)[number])) {
    return { error: "Moyen de réception invalide." };
  }

  const { error } = await supabase.rpc("request_vendor_withdrawal", {
    p_shop_id: shopId,
    p_amount: amount,
    p_payout_phone: payoutPhone,
    p_payout_method: payoutMethod,
  });

  if (error) {
    // `request_vendor_withdrawal` lève des messages déjà clairs et en
    // français pour chaque cas prévu (solde insuffisant, minimum non atteint,
    // etc.) — même convention P0001 que `create_order` (cart-checkout.tsx).
    return {
      error: error.code === "P0001" && error.message ? error.message : "Impossible d'envoyer la demande. Réessaie.",
    };
  }

  revalidatePath("/dashboard/paiements");
  return { success: true };
}
