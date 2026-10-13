import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PAYOUT_METHOD_LABELS, monthStart } from "@/lib/partners";
import { MonthSelect } from "../month-select";
import { fcfa, formatDay, formatMonth, getMyPartner, payoutDeadline } from "../data";

type MonthRow = {
  month: string;
  earned: number;
  paid: number;
  lastPaidAt: string | null;
  business: number;
  pro: number;
};

/** « 07 •• •• •• 12 » : le numéro reste reconnaissable sans être affiché en entier. */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\s/g, "");
  return digits.length <= 4 ? digits : `${digits.slice(0, 2)} •• •• •• ${digits.slice(-2)}`;
}

/**
 * Historique des commissions et des versements, mois par mois (calcul en fin
 * de mois, versement sous 7 jours par Wave / Mobile Money — article 5 du
 * contrat). Filtrable par mois, comme demandé par Isaac.
 */
export default async function PartnerPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ mois?: string }>;
}) {
  const partner = await getMyPartner();
  const { mois } = await searchParams;
  const supabase = await createClient();

  const [{ data: events }, { data: payouts }] = await Promise.all([
    supabase
      .from("partner_commission_events")
      .select("period_month, amount, plan_code")
      .eq("partner_id", partner.id),
    supabase.from("partner_payouts").select("period_month, amount, paid_at").eq("partner_id", partner.id),
  ]);

  const byMonth = new Map<string, MonthRow>();
  const row = (month: string) => {
    let entry = byMonth.get(month);
    if (!entry) {
      entry = { month, earned: 0, paid: 0, lastPaidAt: null, business: 0, pro: 0 };
      byMonth.set(month, entry);
    }
    return entry;
  };
  for (const event of events ?? []) {
    const entry = row(event.period_month);
    entry.earned += event.amount;
    if (event.plan_code === "pro") entry.pro += 1;
    else entry.business += 1;
  }
  for (const payout of payouts ?? []) {
    const entry = row(payout.period_month);
    entry.paid += payout.amount;
    if (!entry.lastPaidAt || payout.paid_at > entry.lastPaidAt) entry.lastPaidAt = payout.paid_at;
  }

  const currentMonth = monthStart(new Date());
  const months = [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month));
  const options = [
    { value: "tous", label: "Tous les mois" },
    ...months.map((m) => ({ value: m.month.slice(0, 7), label: formatMonth(m.month) })),
  ];
  const selected = options.some((o) => o.value === mois) ? (mois as string) : "tous";
  const visible = selected === "tous" ? months : months.filter((m) => m.month.startsWith(selected));

  const totalDue = months
    .filter((m) => m.month < currentMonth)
    .reduce((sum, m) => sum + Math.max(0, m.earned - m.paid), 0);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-semibold text-encre">Paiements</h1>
          <p className="text-sm text-encre/60">
            Calculés en fin de mois, versés sous 7 jours par Wave ou Mobile Money.
          </p>
        </div>
        {months.length > 0 && <MonthSelect value={selected} options={options} basePath="/partenaire/paiements" />}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-ligne bg-white p-3">
          <p className="text-xs text-encre/60">Reste à recevoir (mois terminés)</p>
          <p className="mt-1 font-display text-2xl font-semibold text-encre">{fcfa(totalDue)}</p>
        </div>
        <div className="rounded-lg border border-ligne bg-white p-3">
          <p className="text-xs text-encre/60">Tes paiements arrivent sur</p>
          <p className="mt-1 text-sm font-medium text-encre">
            {partner.payoutMethod ? PAYOUT_METHOD_LABELS[partner.payoutMethod] : "—"}
            {partner.payoutPhone ? ` · ${maskPhone(partner.payoutPhone)}` : ""}
          </p>
          <Link href="/partenaire/reglages" className="text-xs text-vert-actif underline">
            Modifier
          </Link>
        </div>
      </div>

      <section className="mt-5 rounded-lg border border-ligne bg-white px-4 py-1">
        {visible.length === 0 ? (
          <p className="py-3 text-sm text-encre/60">
            Pas encore de commission. Elles apparaissent ici dès le premier paiement d&apos;une
            boutique que tu as amenée.
          </p>
        ) : (
          <ul className="divide-y divide-ligne">
            {visible.map((m) => {
              const due = m.earned - m.paid;
              const isCurrent = m.month === currentMonth;
              let badge: React.ReactNode;
              if (isCurrent) {
                badge = <span className="rounded-full bg-brume px-2 py-0.5 text-xs text-encre/70">Mois en cours</span>;
              } else if (due > 0) {
                badge = (
                  <span className="rounded-full bg-attention/15 px-2 py-0.5 text-xs text-attention">
                    À recevoir avant le {formatDay(payoutDeadline(m.month))}
                  </span>
                );
              } else {
                badge = (
                  <span className="rounded-full bg-succes/15 px-2 py-0.5 text-xs text-succes">
                    Payé{m.lastPaidAt ? ` le ${formatDay(m.lastPaidAt)}` : ""}
                  </span>
                );
              }
              return (
                <li key={m.month} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="text-sm font-medium capitalize text-encre">{formatMonth(m.month)}</p>
                    <p className="text-xs text-encre/60">
                      {/* Nombre de mois d'abonnement payés, pas le détail des
                          montants : ceux-ci ont pu changer d'un mois à l'autre. */}
                      {[m.business > 0 && `${m.business} Business`, m.pro > 0 && `${m.pro} Pro`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-base font-semibold text-encre">{fcfa(m.earned)}</span>
                    {badge}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
