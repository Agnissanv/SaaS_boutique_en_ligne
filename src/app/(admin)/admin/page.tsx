import { createClient } from "@/lib/supabase/server";
import { StorefrontIcon, CheckCircleIcon, PauseCircleIcon, TicketIcon, CoinsIcon } from "@/components/admin/admin-icons";
import type { ReactNode } from "react";

function StatTile({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  tone: "neutral" | "succes" | "erreur" | "vert";
}) {
  const toneClass = {
    neutral: "bg-brume text-vert-actif",
    succes: "bg-succes/15 text-succes",
    erreur: "bg-erreur/15 text-erreur",
    vert: "bg-vert-actif/15 text-vert-sapin",
  }[tone];

  return (
    <div className="flex items-center gap-3 rounded-lg border border-ligne bg-white p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-vert-actif hover:shadow-md">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${toneClass}`}>{icon}</div>
      <div className="min-w-0">
        <p className="truncate text-xs text-encre/60">{label}</p>
        <p className="mt-0.5 font-display text-lg font-semibold text-encre">{value}</p>
      </div>
    </div>
  );
}

// Dashboard admin global (cahier des charges §3.1.C.1) : nombre de
// boutiques, CA plateforme, abonnements actifs. Les policies RLS
// "*_admin_read" (0007_admin_backoffice.sql) donnent à un profil
// role='admin' une visibilité sur toutes les boutiques/commandes/
// abonnements, pas seulement les siens.
//
// Recolorée le 15/09/2026, puis redessinée le même jour avec des icônes et
// une carte CA mise en avant — le premier passage (recolorage pur) était
// trop plat comparé au reste du produit, retour direct d'Isaac.
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
      <h1 className="font-display text-lg font-semibold text-encre">Vue d&apos;ensemble</h1>
      <p className="mt-1 text-sm text-encre/70">
        Chiffres toutes boutiques confondues, sur la plateforme entière.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Boutiques (total)"
          value={shopsTotal ?? 0}
          icon={<StorefrontIcon className="h-5 w-5" />}
          tone="neutral"
        />
        <StatTile
          label="Boutiques actives"
          value={shopsActive ?? 0}
          icon={<CheckCircleIcon className="h-5 w-5" />}
          tone="succes"
        />
        <StatTile
          label="Boutiques suspendues"
          value={shopsSuspended ?? 0}
          icon={<PauseCircleIcon className="h-5 w-5" />}
          tone="erreur"
        />
        <StatTile
          label="Abonnements actifs"
          value={subscriptionsActive ?? 0}
          icon={<TicketIcon className="h-5 w-5" />}
          tone="vert"
        />
      </div>

      {/* Carte CA mise en avant, plutôt qu'une simple ligne de texte : c'est
          le chiffre le plus important de tout le back-office, il mérite plus
          de poids visuel que les compteurs ci-dessus. */}
      <div className="mt-4 flex items-center gap-4 rounded-lg border border-vert-sapin/20 bg-vert-profond p-5">
        {/* Badge recoloré vert le 22/09/2026 (voir decisions-techniques.md) :
            l'ancien badge cuivre tranchait volontairement sur cette carte déjà
            verte ; un badge vert sur vert-profond n'a plus assez de contraste
            (icône text-ivoire conservée pour rester lisible). */}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-vert-actif/30 text-ivoire">
          <CoinsIcon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-ivoire/60">CA plateforme (commandes non annulées)</p>
          <p className="mt-0.5 font-mono text-2xl font-semibold text-ivoire">{platformRevenue} FCFA</p>
        </div>
      </div>
    </div>
  );
}
