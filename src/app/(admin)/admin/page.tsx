import { createClient } from "@/lib/supabase/server";

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-gray-200 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}

// Dashboard admin global (cahier des charges §3.1.C.1) : nombre de
// boutiques, CA plateforme, abonnements actifs. Les policies RLS
// "*_admin_read" (0007_admin_backoffice.sql) donnent à un profil
// role='admin' une visibilité sur toutes les boutiques/commandes/
// abonnements, pas seulement les siens.
export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const [
    { count: shopsTotal },
    { count: shopsActive },
    { count: shopsSuspended },
    { data: orders },
    { count: subscriptionsActive },
  ] = await Promise.all([
    supabase.from("shops").select("id", { count: "exact", head: true }),
    supabase
      .from("shops")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("shops")
      .select("id", { count: "exact", head: true })
      .eq("status", "suspended"),
    supabase.from("orders").select("total_amount").neq("status", "cancelled"),
    // "Actif" au sens réel (pas encore expiré), pas la colonne `status` —
    // voir src/lib/subscription.ts : cette colonne n'est jamais mise à jour
    // après coup sans job planifié, donc filtrer dessus compterait aussi les
    // abonnements expirés depuis longtemps.
    supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .gt("expires_at", new Date().toISOString()),
  ]);

  const platformRevenue = (orders ?? []).reduce((sum, o) => sum + o.total_amount, 0);

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900">Vue d&apos;ensemble</h1>
      <p className="mt-1 text-sm text-gray-600">
        Chiffres toutes boutiques confondues, sur la plateforme entière.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Boutiques (total)" value={shopsTotal ?? 0} />
        <StatTile label="Boutiques actives" value={shopsActive ?? 0} />
        <StatTile label="Boutiques suspendues" value={shopsSuspended ?? 0} />
        <StatTile label="Abonnements actifs" value={subscriptionsActive ?? 0} />
      </div>

      <p className="mt-4 text-sm text-gray-700">
        <span className="font-medium">CA plateforme (toutes commandes non annulées) :</span>{" "}
        {platformRevenue} FCFA
      </p>
    </div>
  );
}
