import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PARTNER_SOURCE_LABELS, PAYOUT_METHOD_LABELS, monthStart } from "@/lib/partners";
import { STATUS_TONE_CLASSES, partnerStatus } from "../status";
import {
  deletePartner,
  detachShopFromPartner,
  endPartnership,
  markPartnerMonthPaid,
  reactivatePartnership,
  regeneratePartnerInvitation,
  revokePartnerAcceptance,
} from "../actions";
import { ConfirmButton } from "./confirm-button";
import { InviteLink } from "./invite-link";
import { TermsForm } from "./terms-form";
import { AttachShopForm } from "./attach-shop-form";

type PartnerStats = {
  clicks: Record<string, number>;
  shops: Record<string, number>;
  shops_total: number;
  active: Record<string, number>;
  earned: number;
};

const fcfa = (amount: number) => `${amount.toLocaleString("fr-FR")} F`;
const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString("fr-FR");
const monthLabel = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

/**
 * Fiche partenaire côté admin : tout ce qu'Isaac contrôle — invitation,
 * conditions, relevés mensuels et versements, boutiques rattachées (avec
 * leurs noms, que la partenaire ne voit pas), fin ou reprise du partenariat.
 */
export default async function AdminPartnerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: partner } = await supabase.from("partners").select("*").eq("id", id).maybeSingle();
  if (!partner) notFound();

  const currentMonth = monthStart(new Date());
  const [{ data: referralsData }, { data: events }, { data: payouts }, { data: statsData }, { data: giftShop }] =
    await Promise.all([
      supabase
        .from("partner_referrals")
        .select("id, source, created_at, shop:shops(id, name, slug)")
        .eq("partner_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("partner_commission_events").select("period_month, amount, plan_code").eq("partner_id", id),
      supabase.from("partner_payouts").select("period_month, amount, paid_at, reference").eq("partner_id", id),
      partner.accepted_at
        ? supabase.rpc("get_partner_stats", { p_month: currentMonth, p_partner_id: id })
        : Promise.resolve({ data: null }),
      partner.gifted_shop_id
        ? supabase.from("shops").select("name, slug").eq("id", partner.gifted_shop_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const referrals = (referralsData ?? []).map((r) => ({
    ...r,
    shop: Array.isArray(r.shop) ? r.shop[0] : r.shop,
  }));
  const shopIds = referrals.map((r) => r.shop?.id).filter((v): v is string => Boolean(v));
  const { data: subscriptions } =
    shopIds.length > 0
      ? await supabase
          .from("subscriptions")
          .select("shop_id, is_trial, expires_at, plan:subscription_plans(code, name)")
          .in("shop_id", shopIds)
      : { data: [] };
  const subscriptionByShop = new Map((subscriptions ?? []).map((s) => [s.shop_id, s]));

  const stats = statsData as PartnerStats | null;
  const status = partnerStatus(partner);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const inviteExpired = !partner.invite_expires_at || partner.invite_expires_at < new Date().toISOString();
  // Numéro de paiement changé après l'acceptation : à vérifier avant de payer.
  const payoutChanged =
    partner.payout_updated_at &&
    partner.accepted_at &&
    new Date(partner.payout_updated_at).getTime() - new Date(partner.accepted_at).getTime() > 60_000;

  // Relevés par mois : commissions, versements, reste dû.
  const months = new Map<string, { earned: number; paid: number; business: number; pro: number; lastPaid: string | null }>();
  const monthRow = (m: string) => {
    if (!months.has(m)) months.set(m, { earned: 0, paid: 0, business: 0, pro: 0, lastPaid: null });
    return months.get(m)!;
  };
  for (const e of events ?? []) {
    const row = monthRow(e.period_month);
    row.earned += e.amount;
    if (e.plan_code === "pro") row.pro += 1;
    else row.business += 1;
  }
  for (const p of payouts ?? []) {
    const row = monthRow(p.period_month);
    row.paid += p.amount;
    if (!row.lastPaid || p.paid_at > row.lastPaid) row.lastPaid = p.paid_at;
  }
  const statements = [...months.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  const card = "rounded-lg border border-ligne bg-white p-4";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/admin/partenaires" className="text-xs text-vert-actif underline">
          ← Partenaires
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-lg font-semibold text-encre">
              {partner.label}
              {partner.code && <span className="ml-2 font-mono text-sm text-encre/50">{partner.code}</span>}
            </h1>
            <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-xs ${STATUS_TONE_CLASSES[status.tone]}`}>
              {status.label}
            </span>
          </div>
          {partner.accepted_at &&
            (partner.ends_on ? (
              <form action={reactivatePartnership.bind(null, id)}>
                <button type="submit" className="rounded-md border border-ligne bg-white px-3 py-2 text-sm font-medium text-encre hover:border-vert-actif">
                  Réactiver le partenariat
                </button>
              </form>
            ) : (
              <form action={endPartnership.bind(null, id)}>
                <ConfirmButton
                  message="Mettre fin au partenariat avec un préavis de 7 jours ? À la date de fin, ses liens ne rapporteront plus et le Pro offert s'arrêtera."
                  className="rounded-md border border-erreur/40 bg-white px-3 py-2 text-sm font-medium text-erreur hover:bg-erreur/5"
                >
                  Terminer (préavis 7 j)
                </ConfirmButton>
              </form>
            ))}
        </div>
      </div>

      {!partner.accepted_at ? (
        <section className={card}>
          <h2 className="font-display text-sm font-semibold text-encre">Invitation</h2>
          {partner.invite_token && !inviteExpired ? (
            <>
              <p className="mt-1 text-xs text-encre/60">
                Valable jusqu&apos;au {day(partner.invite_expires_at!)}, utilisable une seule fois.
              </p>
              <InviteLink url={`${siteUrl}/partenaire/invitation/${partner.invite_token}`} />
            </>
          ) : (
            <p className="mt-1 text-sm text-encre/70">Le lien a expiré.</p>
          )}
          <form action={regeneratePartnerInvitation.bind(null, id)} className="mt-3">
            <button type="submit" className="text-xs text-vert-actif underline">
              Créer un nouveau lien (l&apos;ancien ne marchera plus)
            </button>
          </form>
        </section>
      ) : (
        <section className={card}>
          <h2 className="font-display text-sm font-semibold text-encre">Compte</h2>
          <ul className="mt-2 space-y-1 text-sm text-encre/80">
            <li>
              Nom affiché : <span className="font-medium text-encre">{partner.display_name}</span> · invitation
              acceptée le {day(partner.accepted_at)}
            </li>
            <li>
              Paiement :{" "}
              <span className="font-medium text-encre">
                {partner.payout_method ? PAYOUT_METHOD_LABELS[partner.payout_method] : "—"} · {partner.payout_phone ?? "—"}
              </span>
              {payoutChanged && (
                <span className="ml-2 rounded bg-attention/15 px-1.5 py-0.5 text-xs text-attention">
                  Numéro modifié le {day(partner.payout_updated_at!)} — vérifie avec elle avant de payer
                </span>
              )}
            </li>
            <li>
              Pro offert :{" "}
              {giftShop ? (
                <a href={`/${giftShop.slug}`} target="_blank" rel="noreferrer" className="text-vert-actif underline">
                  {giftShop.name}
                </a>
              ) : (
                "pas encore de boutique"
              )}
            </li>
          </ul>
          <form action={revokePartnerAcceptance.bind(null, id)} className="mt-3">
            <ConfirmButton
              message="Ce n'est pas elle qui a accepté ? Le compte perdra l'accès partenaire, ses codes seront libérés et un nouveau lien d'invitation sera créé."
              className="text-xs text-erreur underline"
            >
              Ce n&apos;est pas elle : annuler l&apos;acceptation
            </ConfirmButton>
          </form>
        </section>
      )}

      {stats && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className={card}>
            <p className="text-xs text-encre/60">Visites ce mois</p>
            <p className="mt-1 text-xl font-semibold text-encre">
              {Object.values(stats.clicks).reduce((s, n) => s + n, 0)}
            </p>
          </div>
          <div className={card}>
            <p className="text-xs text-encre/60">Boutiques (total)</p>
            <p className="mt-1 text-xl font-semibold text-encre">{stats.shops_total}</p>
          </div>
          <div className={card}>
            <p className="text-xs text-encre/60">Abonnements actifs</p>
            <p className="mt-1 text-xl font-semibold text-encre">
              {(stats.active.business ?? 0) + (stats.active.pro ?? 0)}
            </p>
            <p className="text-xs text-encre/50">
              {stats.active.business ?? 0} Business · {stats.active.pro ?? 0} Pro
            </p>
          </div>
          <div className={card}>
            <p className="text-xs text-encre/60">Gagné ce mois</p>
            <p className="mt-1 text-xl font-semibold text-encre">{fcfa(stats.earned)}</p>
          </div>
        </section>
      )}

      <section className={card}>
        <h2 className="font-display text-sm font-semibold text-encre">Relevés mensuels</h2>
        <p className="mt-1 text-xs text-encre/60">
          À payer avant le 7 du mois suivant. Une fois le versement fait par Wave / Mobile Money,
          clique sur « Marquer payé ».
        </p>
        {statements.length === 0 ? (
          <p className="mt-3 text-sm text-encre/60">Aucune commission pour l&apos;instant.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ligne">
            {statements.map(([month, row]) => {
              const due = row.earned - row.paid;
              return (
                <li key={month} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium capitalize text-encre">{monthLabel(month)}</p>
                    <p className="text-xs text-encre/60">
                      {[row.business > 0 && `${row.business} Business`, row.pro > 0 && `${row.pro} Pro`]
                        .filter(Boolean)
                        .join(" · ")}{" "}
                      — {fcfa(row.earned)}
                      {row.paid > 0 && ` · versé ${fcfa(row.paid)}${row.lastPaid ? ` le ${day(row.lastPaid)}` : ""}`}
                    </p>
                  </div>
                  {month >= currentMonth ? (
                    <span className="text-xs text-encre/60">Mois en cours</span>
                  ) : due > 0 ? (
                    <form action={markPartnerMonthPaid.bind(null, id, month)} className="flex gap-2">
                      <input
                        name="reference"
                        placeholder="Référence Wave (facultatif)"
                        aria-label="Référence du versement"
                        className="w-44 rounded-md border border-ligne px-2 py-1.5 text-xs"
                      />
                      <button type="submit" className="shrink-0 rounded-md bg-vert-actif px-3 py-1.5 text-xs font-medium text-ivoire hover:bg-vert-sapin">
                        Marquer payé ({fcfa(due)})
                      </button>
                    </form>
                  ) : (
                    <span className="rounded bg-succes/15 px-1.5 py-0.5 text-xs text-succes">Payé</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={card}>
        <h2 className="font-display text-sm font-semibold text-encre">
          Boutiques rattachées <span className="font-normal text-encre/50">(visible par toi seul)</span>
        </h2>
        {referrals.length === 0 ? (
          <p className="mt-3 text-sm text-encre/60">Aucune boutique pour l&apos;instant.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ligne">
            {referrals.map((referral) => {
              const sub = referral.shop ? subscriptionByShop.get(referral.shop.id) : undefined;
              const plan = Array.isArray(sub?.plan) ? sub?.plan[0] : sub?.plan;
              const expired = sub ? sub.expires_at < new Date().toISOString() : true;
              const subLabel = !sub
                ? "Aucun abonnement"
                : expired
                  ? "Expiré"
                  : sub.is_trial
                    ? "Mois d'essai"
                    : plan?.code === "business" || plan?.code === "pro"
                      ? `${plan.name} payant`
                      : "Gratuit";
              return (
                <li key={referral.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div className="min-w-0">
                    {referral.shop ? (
                      <a href={`/${referral.shop.slug}`} target="_blank" rel="noreferrer" className="font-medium text-encre underline">
                        {referral.shop.name}
                      </a>
                    ) : (
                      <span className="text-encre/50">Boutique supprimée</span>
                    )}
                    <p className="text-xs text-encre/60">
                      {PARTNER_SOURCE_LABELS[referral.source] ?? referral.source} · {day(referral.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-encre/70">{subLabel}</span>
                    <form action={detachShopFromPartner.bind(null, id, referral.id)}>
                      <ConfirmButton
                        message="Retirer cette boutique du partenaire ? Les commissions déjà créditées restent."
                        className="text-xs text-encre/50 underline hover:text-erreur"
                      >
                        Retirer
                      </ConfirmButton>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <AttachShopForm partnerId={id} />
      </section>

      <section className={card}>
        <h2 className="font-display text-sm font-semibold text-encre">Conditions du contrat</h2>
        <div className="mt-3">
          <TermsForm
            partnerId={id}
            label={partner.label}
            businessCommission={partner.business_commission}
            proCommission={partner.pro_commission}
            startsOn={partner.starts_on}
          />
        </div>
        {partner.ends_on && (
          <p className="mt-3 text-xs text-encre/60">Fin du partenariat : {day(partner.ends_on)}</p>
        )}
      </section>

      {/* Nettoyage d'un essai : seulement tant que rien n'a été gagné ni versé. */}
      {(events ?? []).length === 0 && (payouts ?? []).length === 0 && (
        <form action={deletePartner.bind(null, id)}>
          <ConfirmButton
            message="Supprimer définitivement ce partenaire (essai ou invitation inutilisée) ? Ses codes, clics et boutiques rattachées seront effacés."
            className="text-xs text-encre/50 underline hover:text-erreur"
          >
            Supprimer ce partenaire (essai)
          </ConfirmButton>
        </form>
      )}
    </div>
  );
}
