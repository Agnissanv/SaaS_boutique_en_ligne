import { createClient } from "@/lib/supabase/server";
import { CreateCommercialForm } from "./create-commercial-form";
import { MarkPaidButton } from "./mark-paid-button";

type CommercialRow = { id: string; display_name: string | null; commercial_code: string | null; created_at: string };
type ReferralCountRow = { commercial_id: string };
type CommissionRow = { commercial_id: string; amount: number; paid_at: string | null };

/**
 * Vue admin du parrainage COMMERCIAL (23/09/2026 — voir
 * decisions-techniques.md et supabase/migrations/0046_commercial_referral_system.sql).
 * Isaac gère tout depuis ici : création des comptes, suivi des recrutements
 * et des commissions dues, pointage manuel du paiement (versé en dehors de
 * l'app, jamais un virement automatique — voir actions.ts).
 *
 * Trois requêtes simples plutôt qu'un embed PostgREST multi-tables : à ce
 * volume (quelques commerciaux, pas des milliers), regrouper en mémoire est
 * largement assez rapide et plus lisible qu'une jointure/aggregation SQL —
 * même choix pragmatique que /admin/parrainages pour les tables à deux FK
 * vers `shops`.
 */
export default async function AdminCommerciauxPage() {
  const supabase = await createClient();

  const { data: commercialsData } = await supabase
    .from("profiles")
    .select("id, display_name, commercial_code, created_at")
    .eq("role", "commercial")
    .order("created_at", { ascending: false });

  const commercials = (commercialsData ?? []) as CommercialRow[];
  const commercialIds = commercials.map((c) => c.id);

  const [{ data: referralsData }, { data: commissionsData }] = await Promise.all([
    commercialIds.length > 0
      ? supabase.from("commercial_referrals").select("commercial_id").in("commercial_id", commercialIds)
      : Promise.resolve({ data: [] as ReferralCountRow[] }),
    commercialIds.length > 0
      ? supabase
          .from("commercial_commission_events")
          .select("commercial_id, amount, paid_at")
          .in("commercial_id", commercialIds)
      : Promise.resolve({ data: [] as CommissionRow[] }),
  ]);

  const referralCountByCommercial = new Map<string, number>();
  for (const row of (referralsData ?? []) as ReferralCountRow[]) {
    referralCountByCommercial.set(row.commercial_id, (referralCountByCommercial.get(row.commercial_id) ?? 0) + 1);
  }

  const commissionTotalsByCommercial = new Map<string, { earned: number; paid: number }>();
  for (const row of (commissionsData ?? []) as CommissionRow[]) {
    const current = commissionTotalsByCommercial.get(row.commercial_id) ?? { earned: 0, paid: 0 };
    current.earned += row.amount;
    if (row.paid_at) current.paid += row.amount;
    commissionTotalsByCommercial.set(row.commercial_id, current);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Commerciaux</h1>
      <p className="mt-1 text-sm text-encre/70">
        Commission automatique à chaque paiement d&apos;un vendeur recruté :
        500 FCFA par abonnement Business, 1500 FCFA par abonnement Pro. Le
        paiement au commercial se fait en dehors de l&apos;app (Wave, mobile
        money...) — utilise « Marquer tout payé » une fois que c&apos;est fait.
      </p>

      <div className="mt-6">
        <CreateCommercialForm />
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-ligne bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-ligne text-xs text-encre/50">
              <th className="py-3 pl-4 pr-4">Commercial</th>
              <th className="py-3 pr-4">Lien de recrutement</th>
              <th className="py-3 pr-4">Vendeurs recrutés</th>
              <th className="py-3 pr-4">Gagné</th>
              <th className="py-3 pr-4">Payé</th>
              <th className="py-3 pr-4">Dû</th>
              <th className="py-3 pr-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ligne">
            {commercials.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-encre/50">
                  Aucun commercial pour l&apos;instant.
                </td>
              </tr>
            )}
            {commercials.map((commercial) => {
              const recruited = referralCountByCommercial.get(commercial.id) ?? 0;
              const totals = commissionTotalsByCommercial.get(commercial.id) ?? { earned: 0, paid: 0 };
              const due = totals.earned - totals.paid;
              return (
                <tr key={commercial.id} className="transition-colors hover:bg-brume/60">
                  <td className="py-3 pl-4 pr-4">
                    <p className="font-medium text-encre">{commercial.display_name ?? "Sans nom"}</p>
                  </td>
                  <td className="py-3 pr-4">
                    <p className="max-w-[220px] truncate font-mono text-xs text-encre/60">
                      {commercial.commercial_code
                        ? `${siteUrl}/inscription?agent=${commercial.commercial_code}`
                        : "—"}
                    </p>
                  </td>
                  <td className="py-3 pr-4 text-encre/70">{recruited}</td>
                  <td className="py-3 pr-4 font-mono text-encre/70">{totals.earned} FCFA</td>
                  <td className="py-3 pr-4 font-mono text-encre/70">{totals.paid} FCFA</td>
                  <td className="py-3 pr-4 font-mono">
                    <span className={due > 0 ? "font-medium text-attention" : "text-encre/50"}>
                      {due} FCFA
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    {due > 0 && <MarkPaidButton commercialId={commercial.id} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
