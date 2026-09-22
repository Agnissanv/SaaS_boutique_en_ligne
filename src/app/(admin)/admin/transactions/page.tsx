import { createClient } from "@/lib/supabase/server";
import { CheckCircleIcon, PauseCircleIcon, TagIcon, ClipboardIcon } from "@/components/admin/admin-icons";
import type { ReactNode } from "react";

const ACTION_LABELS: Record<string, string> = {
  shop_suspended: "Boutique suspendue",
  shop_activated: "Boutique réactivée",
  subscription_plan_assigned: "Plan d'abonnement assigné",
};

// Icône + teinte par type d'action — même principe que les badges de statut
// de commande/abonnement (`src/lib/orders.ts`, `src/lib/subscription.ts`) :
// une entrée du journal se reconnaît d'un coup d'œil, pas seulement à la
// lecture du texte.
const ACTION_ICON: Record<string, { icon: ReactNode; toneClass: string }> = {
  shop_suspended: { icon: <PauseCircleIcon className="h-4 w-4" />, toneClass: "bg-erreur/15 text-erreur" },
  shop_activated: { icon: <CheckCircleIcon className="h-4 w-4" />, toneClass: "bg-succes/15 text-succes" },
  subscription_plan_assigned: { icon: <TagIcon className="h-4 w-4" />, toneClass: "bg-vert-actif/15 text-vert-sapin" },
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
        <div className="mt-6 flex flex-col items-center gap-2 rounded-lg border border-dashed border-ligne bg-white py-12 text-center">
          <ClipboardIcon className="h-8 w-8 text-encre/30" />
          <p className="text-sm text-encre/60">Aucune action enregistrée pour l&apos;instant.</p>
        </div>
      ) : (
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
    </div>
  );
}
