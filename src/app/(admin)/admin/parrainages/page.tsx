import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GiftIcon } from "@/components/admin/admin-icons";

const PAGE_SIZE = 50;

type ReferralRow = {
  id: string;
  referrer_shop_id: string;
  referred_shop_id: string;
  created_at: string;
  rewarded_at: string | null;
  reward_days: number;
};

type ShopRow = { id: string; name: string; slug: string };

/**
 * Vue admin du système de parrainage (23/09/2026 — voir
 * decisions-techniques.md et supabase/migrations/0045_referral_system.sql).
 * Isaac a confirmé vouloir cette visibilité dès la première version
 * (AskUserQuestion : "Oui, dès maintenant").
 *
 * Même structure que /admin/abonnements (pagination `PAGE_SIZE`, tableau
 * `overflow-x-auto`) mais SANS action possible ici : contrairement aux
 * abonnements (assignation manuelle en attendant PawaPay), rien à faire
 * à la main sur un parrainage — la récompense est entièrement automatique
 * (`maybeGrantReferralReward`, déclenchée par un vrai paiement). Cette page
 * est un journal de suivi, pas un outil de gestion.
 *
 * Deux requêtes séparées plutôt qu'un embed PostgREST : `referrals` a DEUX
 * clés étrangères vers `shops` (referrer_shop_id ET referred_shop_id), ce
 * qui rend un `select("shops(...)")` simple ambigu côté PostgREST. On
 * récupère donc les lignes `referrals` de la page courante, puis TOUTES les
 * boutiques impliquées (parrains + filleuls) en un seul `select` groupé, et
 * on relie les deux en mémoire.
 */
export default async function AdminReferralsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  const {
    data: referralsData,
    count,
    error,
  } = await supabase
    .from("referrals")
    .select("id, referrer_shop_id, referred_shop_id, created_at, rewarded_at, reward_days", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to);

  const referrals = (referralsData ?? []) as ReferralRow[];
  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  const shopIds = Array.from(
    new Set(referrals.flatMap((r) => [r.referrer_shop_id, r.referred_shop_id]))
  );

  const { data: shopsData } =
    shopIds.length > 0
      ? await supabase.from("shops").select("id, name, slug").in("id", shopIds)
      : { data: [] as ShopRow[] };

  const shopById = new Map(((shopsData ?? []) as ShopRow[]).map((s) => [s.id, s]));

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Parrainages</h1>
      <p className="mt-1 text-sm text-encre/70">
        Journal de tous les parrainages entre vendeurs — la récompense (
        {referrals[0]?.reward_days ?? 30} jours offerts, ou passage gratuit
        au plan Pro) est accordée automatiquement dès que le filleul passe
        sur un plan payant, rien à faire ici.
      </p>

      {error && (
        <p className="mt-4 rounded-md border border-erreur/30 bg-erreur/5 px-3 py-2 text-sm text-erreur">
          Impossible de charger les parrainages pour l&apos;instant. Réessaie dans un instant.
        </p>
      )}

      {!error && (
        <div className="mt-6 overflow-x-auto rounded-lg border border-ligne bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-ligne text-xs text-encre/50">
                <th className="py-3 pl-4 pr-4">Parrain</th>
                <th className="py-3 pr-4">Filleul</th>
                <th className="py-3 pr-4">Inscrit le</th>
                <th className="py-3 pr-4">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ligne">
              {referrals.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-encre/50">
                    Aucun parrainage pour l&apos;instant.
                  </td>
                </tr>
              )}
              {referrals.map((referral) => {
                const referrer = shopById.get(referral.referrer_shop_id);
                const referred = shopById.get(referral.referred_shop_id);
                return (
                  <tr key={referral.id} className="transition-colors hover:bg-brume/60">
                    <td className="py-3 pl-4 pr-4">
                      <p className="font-medium text-encre">{referrer?.name ?? "Boutique supprimée"}</p>
                      <p className="text-xs text-encre/50">/{referrer?.slug ?? "—"}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-encre">{referred?.name ?? "Boutique supprimée"}</p>
                      <p className="text-xs text-encre/50">/{referred?.slug ?? "—"}</p>
                    </td>
                    <td className="py-3 pr-4 text-encre/50">
                      {new Date(referral.created_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="py-3 pr-4">
                      {referral.rewarded_at ? (
                        <span
                          className="flex items-center gap-1.5 rounded bg-succes/15 px-1.5 py-0.5 text-xs font-medium text-succes"
                          title={`Récompensé le ${new Date(referral.rewarded_at).toLocaleDateString("fr-FR")}`}
                        >
                          <GiftIcon className="h-3.5 w-3.5" />
                          Récompensé
                        </span>
                      ) : (
                        <span className="rounded bg-sable px-1.5 py-0.5 text-xs text-encre/60">
                          En attente
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!error && totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm">
          {page > 1 ? (
            <Link
              href={`/admin/parrainages?page=${page - 1}`}
              className="rounded-md border border-ligne px-3 py-1.5 text-encre transition hover:border-vert-actif"
            >
              ‹ Précédent
            </Link>
          ) : (
            <span className="rounded-md border border-ligne px-3 py-1.5 text-encre/30">‹ Précédent</span>
          )}
          <span className="px-2 font-mono text-encre/70">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={`/admin/parrainages?page=${page + 1}`}
              className="rounded-md border border-ligne px-3 py-1.5 text-encre transition hover:border-vert-actif"
            >
              Suivant ›
            </Link>
          ) : (
            <span className="rounded-md border border-ligne px-3 py-1.5 text-encre/30">Suivant ›</span>
          )}
        </div>
      )}
    </div>
  );
}
