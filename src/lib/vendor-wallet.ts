import type { createClient, createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Portefeuille vendeur — solde disponible issu du paiement en ligne des
 * commandes clients, ajouté le 29/09/2026 (voir
 * supabase/migrations/0047_order_online_payments_and_vendor_wallet.sql pour
 * le schéma complet et le raisonnement détaillé des décisions prises avec
 * Isaac). KEVA encaisse ces paiements sur son propre compte Nyole (Nyole ne
 * peut reverser qu'au titulaire vérifié du compte, jamais à un tiers — voir
 * doc "Solde et reversements"), donc CE solde n'est jamais de l'argent
 * disponible sur un compte Nyole du vendeur : c'est un compteur de ce qui
 * lui est dû, qu'il peut demander à retirer (voir `request_vendor_withdrawal`
 * dans la migration) — Isaac exécute ensuite le virement réel à la main,
 * exactement comme pour les commissions commerciales.
 *
 * Source de vérité unique : la table `vendor_wallet_entries` (ledger
 * d'événements, jamais un solde stocké à part) — cette fonction ne fait que
 * sommer ses lignes pour une boutique donnée, jamais de logique dupliquée
 * ailleurs.
 */

/**
 * Retrait minimum (FCFA) — choix d'Isaac (29/09/2026, AskUserQuestion) pour
 * éviter une demande de quelques centaines de FCFA qui lui ferait faire un
 * virement Mobile Money pour presque rien. Revérifié côté serveur dans la
 * RPC `request_vendor_withdrawal` (migration 0047) — cette constante-ci ne
 * sert qu'à l'affichage/la validation côté formulaire, jamais la seule
 * barrière réelle.
 */
export const MIN_WITHDRAWAL_AMOUNT = 1000;

// Accepte aussi bien le client service role (webhook) que le client
// authentifié normal (page dashboard vendeur, qui lit via la policy RLS
// `vendor_wallet_entries_owner_read` de toute façon) — les deux exposent la
// même forme `.from(...).select(...).eq(...)` utilisée ici.
type ServiceRoleClient = ReturnType<typeof createServiceRoleClient> | Awaited<ReturnType<typeof createClient>>;

/**
 * Solde disponible d'une boutique = somme de toutes ses lignes
 * `vendor_wallet_entries` (crédits de commande payée, débits de demande de
 * retrait, remboursements de retrait rejeté — voir le détail des signes dans
 * la migration). Utilisable aussi bien côté service role (webhook) que côté
 * client authentifié (dashboard vendeur).
 */
export async function getVendorWalletBalance(
  supabase: ServiceRoleClient,
  shopId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("vendor_wallet_entries")
    .select("amount")
    .eq("shop_id", shopId);

  if (error || !data) return 0;
  return data.reduce((sum, row) => sum + Number(row.amount), 0);
}

/**
 * Crédite le portefeuille d'une boutique après un paiement de commande
 * confirmé par Nyole — appelée uniquement depuis `api/nyole/webhook`
 * (`payment.completed`, branche commande). Le vendeur est crédité du montant
 * TOTAL de la commande (`orders.total_amount`), jamais du montant facturé au
 * client (`payments.amount`, légèrement majoré pour absorber la commission
 * Nyole — voir `grossUpAmountForNyoleCommission` dans src/lib/nyole.ts) :
 * "100% pour le vendeur, on ne touche pas à sa commission" (Isaac).
 */
export async function creditVendorWalletForPaidOrder(
  supabase: ServiceRoleClient,
  params: { shopId: string; orderId: string; amount: number }
): Promise<void> {
  await supabase.from("vendor_wallet_entries").insert({
    shop_id: params.shopId,
    order_id: params.orderId,
    kind: "order_payment_credit",
    amount: params.amount,
  });
}
