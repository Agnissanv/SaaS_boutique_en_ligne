import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CoinsIcon } from "@/components/admin/admin-icons";

const PAGE_SIZE = 50;

type PaymentRow = {
  id: string;
  provider: string;
  provider_transaction_id: string | null;
  intent_plan_code: string | null;
  order_id: string | null;
  amount: number | null;
  currency: string;
  status: string;
  raw_payload: unknown;
  created_at: string;
  shop: { name: string; slug: string } | { name: string; slug: string }[] | null;
};

const STATUS_TABS: { value: "all" | "success" | "failed" | "pending"; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "success", label: "Réussis" },
  { value: "failed", label: "Échoués" },
  { value: "pending", label: "En attente" },
];

const STATUS_BADGE_CLASS: Record<string, string> = {
  success: "bg-succes/15 text-succes",
  failed: "bg-erreur/15 text-erreur",
  pending: "bg-attention/15 text-attention",
};

const STATUS_LABEL: Record<string, string> = {
  success: "Réussi",
  failed: "Échoué",
  pending: "En attente",
};

/**
 * Paiements — tentatives d'abonnement (et, plus tard, de commande en ligne)
 * toutes plateformes confondues (`payments.provider` : "cinetpay" aujourd'hui,
 * "pawapay" une fois cette migration terminée — voir decisions-techniques.md).
 * Ajoutée le 22/09/2026 (suite de l'audit back-office) : jusqu'ici, malgré la
 * policy RLS `payments_admin_read` posée dès le 13/09 (0007), aucune page
 * n'exploitait cet accès — le commentaire de /admin/transactions disait même
 * lui-même "les paiements CinetPay s'y ajouteront ici une fois branchés", en
 * oubliant que CinetPay était déjà branché depuis une semaine.
 *
 * Pas fusionnée avec /admin/transactions (le journal des actions admin) :
 * source différente (webhook fournisseur de paiement vs actions admin), donc
 * page séparée plutôt qu'un flux mélangé difficile à filtrer proprement.
 */
export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { status: statusParam, page: pageParam } = await searchParams;
  const status =
    statusParam === "success" || statusParam === "failed" || statusParam === "pending"
      ? statusParam
      : "all";
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  let query = supabase
    .from("payments")
    .select(
      "id, provider, provider_transaction_id, intent_plan_code, order_id, amount, currency, status, raw_payload, created_at, shop:shops(name, slug)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data: payments, count, error } = await query;
  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Paiements</h1>
      <p className="mt-1 text-sm text-encre/70">
        Tentatives de paiement d&apos;abonnement, tous fournisseurs confondus. Le statut vient
        toujours d&apos;une vérification côté fournisseur — jamais du seul webhook.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value === "all" ? "/admin/paiements" : `/admin/paiements?status=${tab.value}`}
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

      {error && (
        <p className="mt-4 rounded-md border border-erreur/30 bg-erreur/5 px-3 py-2 text-sm text-erreur">
          Impossible de charger les paiements pour l&apos;instant. Réessaie dans un instant.
        </p>
      )}

      {!error && (payments ?? []).length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-lg border border-dashed border-ligne bg-white py-12 text-center">
          <CoinsIcon className="h-8 w-8 text-encre/30" />
          <p className="text-sm text-encre/60">Aucun paiement ici.</p>
        </div>
      ) : error ? null : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-ligne bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-ligne text-xs text-encre/50">
                <th className="py-3 pl-4 pr-4">Boutique</th>
                <th className="py-3 pr-4">Fournisseur</th>
                <th className="py-3 pr-4">Type</th>
                <th className="py-3 pr-4">Montant</th>
                <th className="py-3 pr-4">Statut</th>
                <th className="py-3 pr-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ligne">
              {(payments as PaymentRow[]).map((p) => {
                const shop = Array.isArray(p.shop) ? p.shop[0] : p.shop;
                return (
                  <tr key={p.id} className="align-top transition-colors hover:bg-brume/60">
                    <td className="py-3 pl-4 pr-4">
                      {shop ? (
                        <>
                          <p className="font-medium text-encre">{shop.name}</p>
                          <p className="text-xs text-encre/50">/{shop.slug}</p>
                        </>
                      ) : (
                        <span className="text-encre/40">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-encre/70 capitalize">{p.provider}</td>
                    <td className="py-3 pr-4 text-encre/70">
                      {p.order_id ? "Commande" : p.intent_plan_code ? `Abonnement (${p.intent_plan_code})` : "—"}
                    </td>
                    <td className="py-3 pr-4 font-mono text-encre/70">
                      {p.amount !== null ? `${p.amount} ${p.currency}` : "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${STATUS_BADGE_CLASS[p.status] ?? "bg-sable text-encre/60"}`}
                      >
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-encre/50">
                      {new Date(p.created_at).toLocaleString("fr-FR")}
                      {p.status === "failed" && p.raw_payload != null && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs text-vert-actif">Détails</summary>
                          <pre className="mt-1 max-w-xs overflow-x-auto rounded bg-brume p-2 text-[10px] text-encre/70">
                            {JSON.stringify(p.raw_payload, null, 2)}
                          </pre>
                        </details>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!error && totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm">
          {page > 1 ? (
            <Link
              href={`/admin/paiements?${new URLSearchParams({ ...(status !== "all" ? { status } : {}), page: String(page - 1) })}`}
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
              href={`/admin/paiements?${new URLSearchParams({ ...(status !== "all" ? { status } : {}), page: String(page + 1) })}`}
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
