import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const PAYMENT_LABELS: Record<string, string> = {
  cash_on_delivery: "Paiement à la livraison",
  mobile_money: "Mobile Money",
};

type Order = {
  id: string;
  customer_name: string;
  status: string;
  payment_method: string;
  total_amount: number;
  created_at: string;
};

/**
 * Page "Paiements" — créée le 15/09/2026 en réponse au manque "Historique
 * des paiements reçus" du cahier des charges (§3.1.A.6). IMPORTANT :
 * l'intégration CinetPay/Mobile Money reste explicitement hors scope du
 * mandat du 15/09/2026 ("sauf ce qui dépend encore des moyens de paiement"),
 * donc ceci n'est PAS un relevé de transactions CinetPay — la table
 * `payments` n'est alimentée par aucun webhook actif pour l'instant (le
 * stub `src/app/api/cinetpay/webhook/route.ts` n'est jamais appelé en
 * pratique tant que le compte marchand n'est pas validé).
 *
 * Choix : un relevé basé sur les COMMANDES elles-mêmes plutôt que sur la
 * table `payments`, en utilisant le seul mode de paiement réellement actif
 * aujourd'hui, le paiement à la livraison. "Encaissé" = commandes livrées
 * (le vendeur a physiquement reçu l'argent à la livraison) ; "en attente" =
 * commandes payées/en préparation (l'argent sera encaissé à la livraison,
 * pas encore fait) ; les commandes annulées ne comptent jamais. C'est une
 * approximation qui donne une vraie valeur au vendeur dès maintenant, à
 * remplacer par un vrai relevé de transactions CinetPay une fois le
 * paiement en ligne branché — voir claude/decisions-techniques.md pour le
 * détail de ce choix.
 */
export default async function PaymentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .eq("owner_id", user?.id ?? "")
    .maybeSingle();

  if (!shop) {
    redirect("/dashboard/boutique");
  }

  const { data: orders } = await supabase
    .from("orders")
    .select("id, customer_name, status, payment_method, total_amount, created_at")
    .eq("shop_id", shop.id)
    .neq("status", "cancelled")
    .neq("status", "pending")
    .order("created_at", { ascending: false });

  const rows = (orders ?? []) as Order[];
  const received = rows.filter((o) => o.status === "delivered");
  const awaiting = rows.filter((o) => o.status !== "delivered");
  const totalReceived = received.reduce((sum, o) => sum + o.total_amount, 0);
  const totalAwaiting = awaiting.reduce((sum, o) => sum + o.total_amount, 0);

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Paiements</h1>
      <p className="mt-2 text-sm text-encre/70">
        Le paiement en ligne (Mobile Money) n&apos;est pas encore disponible :
        ce relevé se base sur le paiement à la livraison, seul mode actif
        aujourd&apos;hui.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="rounded-lg border border-ligne bg-white p-4">
          <p className="text-xs text-encre/60">Encaissé (livrées)</p>
          <p className="mt-1 font-mono text-lg font-semibold text-cuivre-profond">
            {totalReceived} FCFA
          </p>
        </div>
        <div className="rounded-lg border border-ligne bg-white p-4">
          <p className="text-xs text-encre/60">À encaisser à la livraison</p>
          <p className="mt-1 font-mono text-lg font-semibold text-cuivre-profond">
            {totalAwaiting} FCFA
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-encre/70">
          Aucun paiement pour l&apos;instant.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-ligne">
          {rows.map((order) => (
            <li key={order.id} className="py-3">
              <Link
                href={`/dashboard/commandes/${order.id}`}
                className="flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-encre">
                    {order.customer_name}
                    <span
                      className={`ml-2 rounded px-1.5 py-0.5 text-xs ${
                        order.status === "delivered"
                          ? "bg-succes/15 text-succes"
                          : "bg-attention/15 text-attention"
                      }`}
                    >
                      {order.status === "delivered" ? "Encaissé" : "À encaisser"}
                    </span>
                  </p>
                  <p className="text-sm text-encre/70">
                    {PAYMENT_LABELS[order.payment_method] ?? order.payment_method} —{" "}
                    {new Date(order.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <p className="shrink-0 font-mono text-sm text-cuivre-profond">
                  {order.total_amount} FCFA
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
