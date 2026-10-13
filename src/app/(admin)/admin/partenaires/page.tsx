import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { monthStart } from "@/lib/partners";
import { CreatePartnerForm } from "./create-partner-form";
import { STATUS_TONE_CLASSES, partnerStatus } from "./status";

type PartnerStats = { shops_total: number; active: Record<string, number> };

/**
 * Liste des partenaires (programme partenaire influenceur, 13/10/2026) :
 * statut, boutiques amenées, abonnements actifs et reste à payer (mois
 * terminés). Le détail et toutes les actions sont sur la fiche de chacun.
 */
export default async function AdminPartnersPage() {
  const supabase = await createClient();
  const { data: partnersData } = await supabase
    .from("partners")
    .select("id, label, display_name, code, accepted_at, invite_expires_at, starts_on, ends_on, created_at")
    .order("created_at", { ascending: false });
  const partners = partnersData ?? [];
  const ids = partners.map((p) => p.id);
  const currentMonth = monthStart(new Date());

  const [{ data: events }, { data: payouts }, statsList] = await Promise.all([
    ids.length > 0
      ? supabase.from("partner_commission_events").select("partner_id, amount, period_month").in("partner_id", ids)
      : Promise.resolve({ data: [] as { partner_id: string; amount: number; period_month: string }[] }),
    ids.length > 0
      ? supabase.from("partner_payouts").select("partner_id, amount, period_month").in("partner_id", ids)
      : Promise.resolve({ data: [] as { partner_id: string; amount: number; period_month: string }[] }),
    Promise.all(
      partners.map(async (p) => {
        if (!p.accepted_at) return null;
        const { data } = await supabase.rpc("get_partner_stats", { p_month: currentMonth, p_partner_id: p.id });
        return data as PartnerStats | null;
      })
    ),
  ]);

  const dueByPartner = new Map<string, number>();
  for (const e of events ?? []) {
    if (e.period_month >= currentMonth) continue;
    dueByPartner.set(e.partner_id, (dueByPartner.get(e.partner_id) ?? 0) + e.amount);
  }
  for (const p of payouts ?? []) {
    if (p.period_month >= currentMonth) continue;
    dueByPartner.set(p.partner_id, (dueByPartner.get(p.partner_id) ?? 0) - p.amount);
  }

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Partenaires</h1>
      <p className="mt-1 text-sm text-encre/70">
        Influenceuses qui font connaître KEVA. Commission mensuelle sur chaque abonnement payant
        qu&apos;elles amènent, boutique Pro offerte pendant le partenariat. Tu les paies en dehors de
        l&apos;app (Wave, Mobile Money) et tu l&apos;indiques sur leur fiche.
      </p>

      <div className="mt-6">
        <CreatePartnerForm />
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-ligne bg-white">
        {partners.length === 0 ? (
          <p className="p-4 text-sm text-encre/60">Aucun partenaire pour l&apos;instant.</p>
        ) : (
          <ul className="divide-y divide-ligne">
            {partners.map((partner, index) => {
              const status = partnerStatus(partner);
              const stats = statsList[index];
              const active = (stats?.active.business ?? 0) + (stats?.active.pro ?? 0);
              const due = Math.max(0, dueByPartner.get(partner.id) ?? 0);
              return (
                <li key={partner.id}>
                  <Link
                    href={`/admin/partenaires/${partner.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 p-3 hover:bg-brume/60"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-encre">
                        {partner.label}
                        {partner.code && (
                          <span className="ml-2 font-mono text-xs text-encre/50">{partner.code}</span>
                        )}
                      </p>
                      <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-xs ${STATUS_TONE_CLASSES[status.tone]}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="flex gap-5 text-right text-xs text-encre/60">
                      <div>
                        <p className="text-sm font-semibold text-encre">{stats?.shops_total ?? 0}</p>
                        boutiques
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-encre">{active}</p>
                        actifs
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${due > 0 ? "text-attention" : "text-encre"}`}>
                          {due.toLocaleString("fr-FR")} F
                        </p>
                        à payer
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
