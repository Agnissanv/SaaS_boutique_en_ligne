import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 50;

const PAYMENT_LABELS: Record<string, string> = {
  cash_on_delivery: "Paiement à la livraison",
  mobile_money: "Mobile Money",
};

type StatusFilter = "all" | "received" | "awaiting";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "received", label: "Encaissé" },
  { value: "awaiting", label: "À encaisser" },
];

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
 *
 * **Filtre + pagination ajoutés le 22/09/2026** (audit "filtres partout"
 * d'Isaac) : la liste se chargeait entièrement sans limite. Les deux totaux
 * (Encaissé/À encaisser) restent calculés sur TOUTES les commandes pertinentes
 * (requête légère séparée, juste statut + montant) — pas seulement la page
 * ou le filtre courant, sinon ils deviendraient faux.
 */
export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string; page?: string }>;
}) {
  const { statut: statusParam, page: pageParam } = await searchParams;
  const status: StatusFilter =
    statusParam === "received" || statusParam === "awaiting" ? statusParam : "all";
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

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

  let query = supabase
    .from("orders")
    .select("id, customer_name, status, payment_method, total_amount, created_at", { count: "exact" })
    .eq("shop_id", shop.id)
    .neq("status", "cancelled")
    .neq("status", "pending");

  if (status === "received") query = query.eq("status", "delivered");
  if (status === "awaiting") query = query.neq("status", "delivered");

  const [{ data: orders, count }, { data: allRelevant }] = await Promise.all([
    query.order("created_at", { ascending: false }).range(from, to),
    supabase
      .from("orders")
      .select("status, total_amount")
      .eq("shop_id", shop.id)
      .neq("status", "cancelled")
      .neq("status", "pending"),
  ]);

  const rows = (orders ?? []) as Order[];
  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;
  const allRows = (allRelevant ?? []) as Pick<Order, "status" | "total_amount">[];
  const totalReceived = allRows
    .filter((o) => o.status === "delivered")
    .reduce((sum, o) => sum + o.total_amount, 0);
  const totalAwaiting = allRows
    .filter((o) => o.status !== "delivered")
    .reduce((sum, o) => sum + o.total_amount, 0);

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
          <p className="mt-1 font-mono text-lg font-semibold text-vert-actif">
            {totalReceived} FCFA
          </p>
        </div>
        <div className="rounded-lg border border-ligne bg-white p-4">
          <p className="text-xs text-encre/60">À encaisser à la livraison</p>
          <p className="mt-1 font-mono text-lg font-semibold text-vert-actif">
            {totalAwaiting} FCFA
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value === "all" ? "/dashboard/paiements" : `/dashboard/paiements?statut=${tab.value}`}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              status === tab.value
                ? "border-vert-actif bg-vert-actif/10 font-medium text-vert-sapin"
                : "border-ligne text-encre/70 hover:border-vert-actif"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-encre/70">
          {status !== "all"
            ? "Aucun paiement ne correspond à ce filtre."
            : "Aucun paiement pour l'instant."}
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
                <p className="shrink-0 font-mono text-sm text-vert-actif">
                  {order.total_amount} FCFA
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm">
          {page > 1 ? (
            <Link
              href={`/dashboard/paiements?${new URLSearchParams({ ...(status !== "all" ? { statut: status } : {}), page: String(page - 1) })}`}
              className="rounded-md border border-ligne px-3 py-1.5 text-encre transition hover:border-vert-actif"
            >
              ‹ Précédent
            </Link>
          ) : (
            <span className="rounded-md border border-ligne px-3 py-1.5 text-encre/30">‹ Précédent</span>
          )}
          <span className="px-2 font-mono text-encre/70">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={`/dashboard/paiements?${new URLSearchParams({ ...(status !== "all" ? { statut: status } : {}), page: String(page + 1) })}`}
              className="rounded-md border border-ligne px-3 py-1.5 text-encre transition hover:border-vert-actif"
            >
              Suivant ›
            </Link>
          ) : (
            <span className="rounded-md border border-ligne px-3 py-1.5 text-encre/30">Suivant ›</span>
          )}
        </div>
      )}
    </div>
  );
}
