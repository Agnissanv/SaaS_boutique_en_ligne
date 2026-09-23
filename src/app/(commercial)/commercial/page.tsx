import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CopyLink } from "@/components/copy-link";
import { COMMERCIAL_COMMISSION_BY_PLAN_CODE } from "@/lib/commercial-referrals";

type ReferralRow = { id: string; created_at: string; shop: { name: string } | { name: string }[] | null };
type CommissionRow = { id: string; plan_code: string; amount: number; created_at: string; paid_at: string | null };

const PLAN_LABEL: Record<string, string> = { business: "Business", pro: "Pro" };

/**
 * Espace commercial (23/09/2026, parrainage commercial — voir
 * decisions-techniques.md et supabase/migrations/0046_commercial_referral_system.sql).
 * Un seul écran : lien à partager + liste des vendeurs recrutés + suivi des
 * commissions dues (versées en dehors de l'app par Isaac, voir
 * admin/commerciaux/actions.ts) — pas besoin d'un dashboard complet comme
 * côté vendeur pour ce premier jet.
 *
 * `commercial_referrals` n'a qu'UNE seule clé étrangère vers `shops`
 * (contrairement à `referrals`, qui en a deux — referrer ET referred) :
 * l'embed PostgREST `shop:shops(name)` est donc sans ambiguïté ici, pas
 * besoin des deux requêtes séparées utilisées sur /dashboard/parrainage et
 * /admin/parrainages.
 */
export default async function CommercialPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/connexion");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, commercial_code")
    .eq("id", user.id)
    .maybeSingle();

  const [{ data: referralsData }, { data: commissionsData }] = await Promise.all([
    supabase
      .from("commercial_referrals")
      .select("id, created_at, shop:shops(name)")
      .eq("commercial_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("commercial_commission_events")
      .select("id, plan_code, amount, created_at, paid_at")
      .eq("commercial_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const referrals = (referralsData ?? []) as ReferralRow[];
  const commissions = (commissionsData ?? []) as CommissionRow[];

  const earned = commissions.reduce((sum, c) => sum + c.amount, 0);
  const paid = commissions.filter((c) => c.paid_at).reduce((sum, c) => sum + c.amount, 0);
  const due = earned - paid;

  const referralUrl = profile?.commercial_code
    ? `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/inscription?agent=${profile.commercial_code}`
    : null;

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">
        Bienvenue{profile?.display_name ? `, ${profile.display_name}` : ""}
      </h1>
      <p className="mt-2 text-sm text-encre/70">
        Partage ton lien avec des vendeurs. Tu gagnes {COMMERCIAL_COMMISSION_BY_PLAN_CODE.business}{" "}
        FCFA à chaque paiement d&apos;un abonnement Business et{" "}
        {COMMERCIAL_COMMISSION_BY_PLAN_CODE.pro} FCFA à chaque paiement d&apos;un abonnement
        Pro — tant que le vendeur reste abonné.
      </p>

      {referralUrl && (
        <div className="mt-6 rounded-lg border border-ligne bg-white p-4">
          <h2 className="font-display text-sm font-semibold text-encre">Ton lien</h2>
          <div className="mt-3">
            <CopyLink url={referralUrl} />
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-ligne bg-white p-3 text-center">
          <p className="text-lg font-semibold text-encre">{earned} FCFA</p>
          <p className="text-xs text-encre/50">Gagné</p>
        </div>
        <div className="rounded-lg border border-ligne bg-white p-3 text-center">
          <p className="text-lg font-semibold text-encre">{paid} FCFA</p>
          <p className="text-xs text-encre/50">Payé</p>
        </div>
        <div className="rounded-lg border border-ligne bg-white p-3 text-center">
          <p className={`text-lg font-semibold ${due > 0 ? "text-attention" : "text-encre"}`}>{due} FCFA</p>
          <p className="text-xs text-encre/50">Dû</p>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-ligne bg-white p-4">
        <h2 className="font-display text-sm font-semibold text-encre">Vendeurs recrutés</h2>
        {referrals.length === 0 ? (
          <p className="mt-3 text-sm text-encre/60">Aucun vendeur inscrit avec ton lien pour l&apos;instant.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {referrals.map((referral) => {
              const shop = Array.isArray(referral.shop) ? referral.shop[0] : referral.shop;
              return (
                <li
                  key={referral.id}
                  className="flex items-center justify-between rounded-md border border-ligne/70 bg-brume/40 p-2.5"
                >
                  <p className="truncate text-sm font-medium text-encre">{shop?.name ?? "Boutique supprimée"}</p>
                  <p className="shrink-0 text-xs text-encre/50">
                    {new Date(referral.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-ligne bg-white p-4">
        <h2 className="font-display text-sm font-semibold text-encre">Historique des commissions</h2>
        {commissions.length === 0 ? (
          <p className="mt-3 text-sm text-encre/60">Aucune commission pour l&apos;instant.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {commissions.map((commission) => (
              <li
                key={commission.id}
                className="flex items-center justify-between rounded-md border border-ligne/70 bg-brume/40 p-2.5"
              >
                <div>
                  <p className="text-sm font-medium text-encre">
                    Plan {PLAN_LABEL[commission.plan_code] ?? commission.plan_code} — {commission.amount} FCFA
                  </p>
                  <p className="text-xs text-encre/50">
                    {new Date(commission.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                {commission.paid_at ? (
                  <span className="shrink-0 rounded bg-succes/15 px-1.5 py-0.5 text-xs font-medium text-succes">
                    Payé
                  </span>
                ) : (
                  <span className="shrink-0 rounded bg-sable px-1.5 py-0.5 text-xs text-encre/60">Dû</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
