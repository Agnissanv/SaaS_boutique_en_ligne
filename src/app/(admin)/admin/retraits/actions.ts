"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return profile?.role === "admin" ? { supabase, userId: user.id } : null;
}

/**
 * Demandes de retrait du portefeuille vendeur (29/09/2026 — voir
 * decisions-techniques.md et supabase/migrations/0047_...). Même modèle de
 * confiance que /admin/commerciaux (`markCommercialPaid`) : Isaac exécute le
 * virement Mobile Money réel EN DEHORS de l'app, ces actions ne font que
 * pointer ce qui s'est déjà passé — jamais un virement automatique (Nyole ne
 * peut reverser qu'à son propre compte vérifié, voir le raisonnement complet
 * dans la migration 0047).
 *
 * Le débit du portefeuille a déjà eu lieu à la CRÉATION de la demande (voir
 * `request_vendor_withdrawal`, migration 0047) — marquer payé ne touche donc
 * jamais `vendor_wallet_entries`, seulement le statut de la demande.
 */
export async function markWithdrawalPaid(requestId: string) {
  const admin = await requireAdmin();
  if (!admin) return;
  const { supabase, userId } = admin;

  await supabase
    .from("vendor_withdrawal_requests")
    .update({ status: "paid", processed_at: new Date().toISOString(), processed_by: userId })
    .eq("id", requestId)
    .eq("status", "pending");

  revalidatePath("/admin/retraits");
}

/**
 * Rejette une demande de retrait (numéro invalide, doute sur l'identité du
 * vendeur, etc.) — contrairement à `markWithdrawalPaid`, ceci DOIT recréditer
 * le portefeuille : le débit posé à la création de la demande
 * (`request_vendor_withdrawal`) réservait ce montant en attendant le
 * traitement, un rejet doit donc le rendre disponible à nouveau via une
 * ligne `vendor_wallet_entries` de type 'withdrawal_reversal' (montant
 * positif — voir le garde-fou de signe dans la migration 0047), jamais en
 * modifiant la ligne de débit d'origine (le ledger est un historique
 * d'événements, on ne réécrit jamais une ligne passée).
 */
export async function rejectWithdrawal(requestId: string, note: string) {
  const admin = await requireAdmin();
  if (!admin) return;
  const { supabase, userId } = admin;

  const { data: request } = await supabase
    .from("vendor_withdrawal_requests")
    .select("id, shop_id, amount, status")
    .eq("id", requestId)
    .maybeSingle();

  if (!request || request.status !== "pending") return;

  await supabase
    .from("vendor_withdrawal_requests")
    .update({
      status: "rejected",
      processed_at: new Date().toISOString(),
      processed_by: userId,
      admin_note: note.trim() || null,
    })
    .eq("id", requestId);

  await supabase.from("vendor_wallet_entries").insert({
    shop_id: request.shop_id,
    withdrawal_request_id: request.id,
    kind: "withdrawal_reversal",
    amount: request.amount,
  });

  revalidatePath("/admin/retraits");
}
