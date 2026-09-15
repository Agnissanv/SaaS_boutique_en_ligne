import { createClient } from "@/lib/supabase/server";

const ACTION_LABELS: Record<string, string> = {
  shop_suspended: "Boutique suspendue",
  shop_activated: "Boutique réactivée",
  subscription_plan_assigned: "Plan d'abonnement assigné",
};

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
// — alimenté par les Server Actions de /admin/vendeurs et /admin/abonnements.
// Les paiements CinetPay viendront aussi ici une fois branchés (table
// `payments`, pas encore de flux qui l'alimente).
export default async function AdminTransactionsPage() {
  const supabase = await createClient();

  const { data: logs } = await supabase
    .from("transaction_logs")
    .select("id, action, metadata, created_at, shop:shops(name, slug), actor:profiles(display_name)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Transactions</h1>
      <p className="mt-1 text-sm text-encre/70">
        Journal des actions admin (100 dernières). Les paiements Mobile
        Money s&apos;ajouteront ici une fois CinetPay branché.
      </p>

      {(logs ?? []).length === 0 ? (
        <p className="mt-6 text-sm text-encre/60">Aucune action enregistrée pour l&apos;instant.</p>
      ) : (
        <ul className="mt-6 divide-y divide-ligne text-sm">
          {(logs as LogRow[]).map((log) => {
            const shop = Array.isArray(log.shop) ? log.shop[0] : log.shop;
            const actor = Array.isArray(log.actor) ? log.actor[0] : log.actor;
            return (
              <li key={log.id} className="flex items-center justify-between gap-4 py-2">
                <div>
                  <p className="text-encre">
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
    </div>
  );
}
