import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CheckCircleIcon, PauseCircleIcon, TagIcon, ClipboardIcon } from "@/components/admin/admin-icons";
import type { ReactNode } from "react";

const PAGE_SIZE = 50;

const ACTION_LABELS: Record<string, string> = {
  shop_suspended: "Boutique suspendue",
  shop_activated: "Boutique réactivée",
  subscription_plan_assigned: "Plan d'abonnement assigné",
  subscription_payment_success: "Paiement d'abonnement réussi",
  subscription_payment_failed: "Paiement d'abonnement échoué",
};

// Icône + teinte par type d'action — même principe que les badges de statut
// de commande/abonnement (`src/lib/orders.ts`, `src/lib/subscription.ts`) :
// une entrée du journal se reconnaît d'un coup d'œil, pas seulement à la
// lecture du texte.
const ACTION_ICON: Record<string, { icon: ReactNode; toneClass: string }> = {
  shop_suspended: { icon: <PauseCircleIcon className="h-4 w-4" />, toneClass: "bg-erreur/15 text-erreur" },
  shop_activated: { icon: <CheckCircleIcon className="h-4 w-4" />, toneClass: "bg-succes/15 text-succes" },
  subscription_plan_assigned: { icon: <TagIcon className="h-4 w-4" />, toneClass: "bg-vert-actif/15 text-vert-sapin" },
  subscription_payment_success: { icon: <CheckCircleIcon className="h-4 w-4" />, toneClass: "bg-succes/15 text-succes" },
  subscription_payment_failed: { icon: <PauseCircleIcon className="h-4 w-4" />, toneClass: "bg-erreur/15 text-erreur" },
};
const DEFAULT_ACTION_ICON = { icon: <TagIcon className="h-4 w-4" />, toneClass: "bg-brume text-vert-actif" };

type LogRow = {
  id: string;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
  shop: { name: string; slug: string } | { name: string; slug: string }[] | null;
  actor: { display_name: string | null } | { display_name: string | null }[] | null;
};

// Logs des transactions (cahier des charges §3.1.C.4) : audit des actions
// admin sensibles (suspension/réactivation de boutique, changement de plan)
// et des webhooks de paiement — alimenté par les Server Actions de
// /admin/vendeurs, /admin/abonnements et /api/cinetpay/webhook.
//
// Filtre + pagination ajoutés le 22/09/2026 (reprise de l'audit back-office,
// point signalé comme le plus urgent après les messages de contact) : cette
// page plafonnait jusqu'ici à 100 lignes sans aucun moyen d'aller plus loin
// ni de chercher une action précise — invivable dès que le volume grandit
// avec 1000-2000 boutiques. Même pattern de pagination que les autres pages
// admin (`page` + `.range()` + `{count: "exact"}`).
export default async function AdminTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string }>;
}) {
  const { action: actionParam, page: pageParam } = await searchParams;
  const actionFilter = actionParam && actionParam in ACTION_LABELS ? actionParam : undefined;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  let query = supabase
    .from("transaction_logs")
    .select("id, action, metadata, created_at, shop:shops(name, slug), actor:profiles(display_name)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (actionFilter) {
    query = query.eq("action", actionFilter);
  }

  const { data: logs, count, error } = await query;
  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Transactions</h1>
      <p className="mt-1 text-sm text-encre/70">
        Journal des actions admin et des paiements d&apos;abonnement.
      </p>

      <form method="GET" className="mt-4 flex flex-wrap items-center gap-2">
        <select
          name="action"
          defaultValue={actionFilter ?? ""}
          className="rounded-md border border-ligne px-3 py-1.5 text-sm focus:ring-2 focus:ring-vert-actif"
        >
          <option value="">Toutes les actions</option>
          {Object.entries(ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md border border-ligne px-3 py-1.5 text-sm text-encre/70 hover:border-vert-actif"
        >
          Filtrer
        </button>
        {actionFilter && (
          <Link href="/admin/transactions" className="text-sm text-encre/50 underline hover:text-encre">
            Réinitialiser
          </Link>
        )}
      </form>

      {error && (
        <p className="mt-4 rounded-md border border-erreur/30 bg-erreur/5 px-3 py-2 text-sm text-erreur">
          Impossible de charger le journal pour l&apos;instant. Réessaie dans un instant.
        </p>
      )}

      {!error && (logs ?? []).length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-lg border border-dashed border-ligne bg-white py-12 text-center">
          <ClipboardIcon className="h-8 w-8 text-encre/30" />
          <p className="text-sm text-encre/60">Aucune action enregistrée ici.</p>
        </div>
      ) : error ? null : (
        <ul className="mt-6 divide-y divide-ligne rounded-lg border border-ligne bg-white text-sm">
          {(logs as LogRow[]).map((log) => {
            const shop = Array.isArray(log.shop) ? log.shop[0] : log.shop;
            const actor = Array.isArray(log.actor) ? log.actor[0] : log.actor;
            const { icon, toneClass } = ACTION_ICON[log.action] ?? DEFAULT_ACTION_ICON;
            return (
              <li key={log.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-brume/60">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${toneClass}`}>
                  {icon}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-encre">
                    {ACTION_LABELS[log.action] ?? log.action}
                    {shop ? ` — ${shop.name}` : ""}
                  </p>
                  <p className="text-xs text-encre/50">
                    Par {actor?.display_name ?? "—"} le{" "}
                    {new Date(log.created_at).toLocaleString("fr-FR")}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!error && totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm">
          {page > 1 ? (
            <Link
              href={`/admin/transactions?${new URLSearchParams({ ...(actionFilter ? { action: actionFilter } : {}), page: String(page - 1) })}`}
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
              href={`/admin/transactions?${new URLSearchParams({ ...(actionFilter ? { action: actionFilter } : {}), page: String(page + 1) })}`}
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
