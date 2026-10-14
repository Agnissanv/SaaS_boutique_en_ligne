import { createClient } from "@/lib/supabase/server";
import { InstallInvite } from "@/components/install-invite";
import { PARTNER_SOURCE_LABELS, monthStart } from "@/lib/partners";
import { MonthSelect } from "./month-select";
import { fcfa, formatMonth, getMyPartner } from "./data";

type PartnerStats = {
  month: string;
  clicks: Record<string, number>;
  shops: Record<string, number>;
  shops_total: number;
  active: Record<string, number>;
  earned: number;
};

const SOURCE_ORDER = ["tiktok", "instagram", "facebook", "general", "code", "admin"];

/** Mois disponibles dans le sélecteur : du début du partenariat à aujourd'hui. */
function monthOptions(startsOn: string): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let offset = 0; offset > -36; offset--) {
    const start = monthStart(now, offset);
    options.push({ value: start.slice(0, 7), label: formatMonth(start) });
    if (start <= startsOn.slice(0, 7) + "-01") break;
  }
  return options;
}

/**
 * Résultats du mois (accueil de l'espace partenaire) : clics, boutiques
 * créées, abonnements actifs, gains — uniquement des chiffres, jamais le nom
 * des boutiques (décision d'Isaac). Données calculées par `get_partner_stats`.
 */
export default async function PartnerResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ mois?: string }>;
}) {
  const partner = await getMyPartner();
  const { mois } = await searchParams;
  const options = monthOptions(partner.startsOn);
  const selected = options.some((o) => o.value === mois) ? (mois as string) : options[0].value;

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_partner_stats", { p_month: `${selected}-01` });
  const stats = (data as PartnerStats | null) ?? {
    month: `${selected}-01`,
    clicks: {},
    shops: {},
    shops_total: 0,
    active: {},
    earned: 0,
  };

  const totalClicks = Object.values(stats.clicks).reduce((sum, n) => sum + n, 0);
  const totalShops = Object.values(stats.shops).reduce((sum, n) => sum + n, 0);
  const business = stats.active.business ?? 0;
  const pro = stats.active.pro ?? 0;
  const sources = SOURCE_ORDER.filter((source) => (stats.clicks[source] ?? 0) + (stats.shops[source] ?? 0) > 0);
  const maxShops = Math.max(1, ...sources.map((source) => stats.shops[source] ?? 0));

  return (
    <div>
      {/* Invitation à installer KEVA (13/10/2026). */}
      <InstallInvite context="partner" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-semibold text-encre">Bonjour {partner.displayName}</h1>
          <p className="text-sm text-encre/70">Tes résultats de partenaire KEVA</p>
        </div>
        <MonthSelect value={selected} options={options} basePath="/partenaire" />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-ligne bg-white p-3">
          <p className="text-xs text-encre/70">Visites via tes liens</p>
          <p className="mt-1 font-display text-2xl font-semibold text-encre">{totalClicks.toLocaleString("fr-FR")}</p>
        </div>
        <div className="rounded-lg border border-ligne bg-white p-3">
          <p className="text-xs text-encre/70">Boutiques créées</p>
          <p className="mt-1 font-display text-2xl font-semibold text-encre">{totalShops}</p>
          <p className="text-xs text-encre/70">{stats.shops_total} au total</p>
        </div>
        <div className="rounded-lg border border-ligne bg-white p-3">
          <p className="text-xs text-encre/70">Abonnements actifs</p>
          <p className="mt-1 font-display text-2xl font-semibold text-encre">{business + pro}</p>
          <p className="text-xs text-encre/70">
            {business} Business · {pro} Pro
          </p>
        </div>
        <div className="rounded-lg border border-vert-actif/30 bg-vert-sapin/5 p-3">
          <p className="text-xs text-vert-sapin">Gagné en {formatMonth(stats.month)}</p>
          <p className="mt-1 font-display text-2xl font-semibold text-vert-sapin">{fcfa(stats.earned)}</p>
        </div>
      </div>

      <section className="mt-6 rounded-lg border border-ligne bg-white p-4">
        <h2 className="font-display text-sm font-semibold text-encre">D&apos;où viennent tes inscrits</h2>
        {sources.length === 0 ? (
          <p className="mt-2 text-sm text-encre/70">
            Rien pour ce mois-ci. Partage tes liens (page « Liens et code ») pour voir tes premiers
            résultats ici.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {sources.map((source) => {
              const shops = stats.shops[source] ?? 0;
              const clicks = stats.clicks[source];
              return (
                <li key={source}>
                  <div className="flex justify-between text-sm">
                    <span className="text-encre">{PARTNER_SOURCE_LABELS[source] ?? source}</span>
                    <span className="text-encre/70">
                      {clicks !== undefined ? `${clicks} visite${clicks > 1 ? "s" : ""} · ` : ""}
                      {shops} boutique{shops > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-brume">
                    <div
                      className="h-1.5 rounded-full bg-vert-actif"
                      style={{ width: `${Math.round((shops / maxShops) * 100)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="mt-5 text-xs leading-relaxed text-encre/70">
        Tu gagnes {fcfa(partner.businessCommission)} par mois pour chaque abonnement Business actif et{" "}
        {fcfa(partner.proCommission)} pour chaque Pro. Le mois d&apos;essai offert à chaque nouvelle
        boutique ne compte pas : ta commission démarre au premier vrai paiement.
      </p>
    </div>
  );
}
