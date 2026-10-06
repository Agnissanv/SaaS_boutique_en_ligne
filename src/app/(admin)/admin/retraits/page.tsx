import { createClient } from "@/lib/supabase/server";
import { WithdrawalActionButtons, payoutMethodLabel } from "./withdrawal-actions-buttons";

type WithdrawalRow = {
  id: string;
  shop_id: string;
  amount: number;
  payout_phone: string;
  payout_method: string;
  status: "pending" | "paid" | "rejected";
  requested_at: string;
  processed_at: string | null;
  admin_note: string | null;
  shops: { name: string; slug: string } | { name: string; slug: string }[] | null;
};

const dateFR = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Demandes de retrait du portefeuille vendeur (29/09/2026 — paiement en
 * ligne des commandes, voir decisions-techniques.md et
 * supabase/migrations/0047_order_online_payments_and_vendor_wallet.sql).
 *
 * KEVA encaisse les paiements de commande sur SON compte Nyole (impossible
 * de reverser directement au vendeur — voir le raisonnement complet dans la
 * migration), donc chaque demande ici correspond à un virement Mobile Money
 * qu'Isaac doit faire lui-même, en dehors de l'app, puis pointer comme payé —
 * exactement le même modèle que /admin/commerciaux.
 *
 * Deux sections : les demandes EN ATTENTE (celles qui nécessitent une
 * action), et un historique court des dernières traitées (payées/rejetées)
 * pour garder une trace visible sans devoir fouiller `transaction_logs`.
 */
export default async function AdminRetraitsPage() {
  const supabase = await createClient();

  const [{ data: pendingData }, { data: recentData }] = await Promise.all([
    supabase
      .from("vendor_withdrawal_requests")
      .select("id, shop_id, amount, payout_phone, payout_method, status, requested_at, processed_at, admin_note, shops(name, slug)")
      .eq("status", "pending")
      .order("requested_at", { ascending: true }),
    supabase
      .from("vendor_withdrawal_requests")
      .select("id, shop_id, amount, payout_phone, payout_method, status, requested_at, processed_at, admin_note, shops(name, slug)")
      .in("status", ["paid", "rejected"])
      .order("processed_at", { ascending: false })
      .limit(20),
  ]);

  const pending = (pendingData ?? []) as WithdrawalRow[];
  const recent = (recentData ?? []) as WithdrawalRow[];

  const shopOf = (row: WithdrawalRow) => (Array.isArray(row.shops) ? row.shops[0] : row.shops);

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Retraits</h1>
      <p className="mt-1 text-sm text-encre/70">
        Le paiement en ligne des commandes est encaissé sur le compte Nyole de
        KEVA. Chaque demande ci-dessous correspond à un virement Mobile Money
        à faire toi-même, puis à pointer comme payé.
      </p>

      <h2 className="mt-6 text-sm font-medium text-encre">En attente</h2>
      <div className="mt-2 overflow-x-auto rounded-lg border border-ligne bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-ligne text-xs text-encre/50">
              <th className="py-3 pl-4 pr-4">Boutique</th>
              <th className="py-3 pr-4">Montant</th>
              <th className="py-3 pr-4">Réception</th>
              <th className="py-3 pr-4">Demandée le</th>
              <th className="py-3 pr-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ligne">
            {pending.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-encre/50">
                  Aucune demande en attente.
                </td>
              </tr>
            )}
            {pending.map((row) => {
              const shop = shopOf(row);
              return (
                <tr key={row.id} className="transition-colors hover:bg-brume/60">
                  <td className="py-3 pl-4 pr-4 font-medium text-encre">{shop?.name ?? "—"}</td>
                  <td className="py-3 pr-4 font-mono text-encre/70">{row.amount} FCFA</td>
                  <td className="py-3 pr-4 text-encre/70">
                    {payoutMethodLabel(row.payout_method)} — {row.payout_phone}
                  </td>
                  <td className="py-3 pr-4 text-encre/50">{dateFR(row.requested_at)}</td>
                  <td className="py-3 pr-4">
                    <WithdrawalActionButtons requestId={row.id} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 text-sm font-medium text-encre">Traitées récemment</h2>
      <div className="mt-2 overflow-x-auto rounded-lg border border-ligne bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-ligne text-xs text-encre/50">
              <th className="py-3 pl-4 pr-4">Boutique</th>
              <th className="py-3 pr-4">Montant</th>
              <th className="py-3 pr-4">Statut</th>
              <th className="py-3 pr-4">Traitée le</th>
              <th className="py-3 pr-4">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ligne">
            {recent.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-encre/50">
                  Aucune demande traitée pour l&apos;instant.
                </td>
              </tr>
            )}
            {recent.map((row) => {
              const shop = shopOf(row);
              return (
                <tr key={row.id}>
                  <td className="py-3 pl-4 pr-4 text-encre/70">{shop?.name ?? "—"}</td>
                  <td className="py-3 pr-4 font-mono text-encre/70">{row.amount} FCFA</td>
                  <td className="py-3 pr-4">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${
                        row.status === "paid" ? "bg-succes/15 text-succes" : "bg-erreur/15 text-erreur"
                      }`}
                    >
                      {row.status === "paid" ? "Payée" : "Rejetée"}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-encre/50">{row.processed_at ? dateFR(row.processed_at) : "—"}</td>
                  <td className="py-3 pr-4 text-encre/50">{row.admin_note ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
