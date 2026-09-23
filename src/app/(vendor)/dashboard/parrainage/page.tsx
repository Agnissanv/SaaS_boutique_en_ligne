import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { REFERRAL_REWARD_DAYS } from "@/lib/referrals";
import { CopyLink } from "@/components/copy-link";

type ReferralRow = {
  id: string;
  created_at: string;
  rewarded_at: string | null;
  referred_shop_id: string;
};

type ReferredShopRow = { id: string; name: string; slug: string };

/**
 * Page "Parrainage" (23/09/2026, demande d'Isaac : "je veux ajouter un
 * système de parrainage" — voir decisions-techniques.md et
 * supabase/migrations/0045_referral_system.sql pour le détail des règles).
 *
 * Réutilise le SLUG de boutique comme code de parrainage (pas de colonne
 * dédiée) : le lien `${site}/inscription?ref=<slug>` suffit, capturé à
 * l'inscription du filleul puis consommé quand il crée sa propre boutique
 * (`create_referral`, appelée depuis dashboard/boutique/actions.ts).
 *
 * `ownerOnly` (voir sidebar-nav.tsx) : réservé au propriétaire, comme
 * "Ma boutique" et "Abonnement" — un collaborateur n'a pas à gérer le
 * parrainage de la boutique qui l'emploie.
 *
 * Deux requêtes séparées plutôt qu'un embed PostgREST (`referrals:shops(...)`)
 * : la table `referrals` a DEUX clés étrangères vers `shops`
 * (referrer_shop_id ET referred_shop_id), ce qui rend un embed simple
 * ambigu côté PostgREST (il faudrait préciser la contrainte exacte). Plus
 * simple et sans risque de casser au moindre renommage de contrainte : on
 * récupère les lignes `referrals`, puis les boutiques filleules
 * correspondantes en un second `select`, et on relie les deux en mémoire.
 */
export default async function ParrainagePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: shop } = await supabase
    .from("shops")
    .select("id, slug")
    .eq("owner_id", user?.id ?? "")
    .maybeSingle();

  if (!shop) {
    redirect("/dashboard/boutique");
  }

  const { data: referralsData } = await supabase
    .from("referrals")
    .select("id, created_at, rewarded_at, referred_shop_id")
    .eq("referrer_shop_id", shop.id)
    .order("created_at", { ascending: false });

  const referrals = (referralsData ?? []) as ReferralRow[];
  const referredShopIds = referrals.map((r) => r.referred_shop_id);

  const { data: referredShopsData } =
    referredShopIds.length > 0
      ? await supabase.from("shops").select("id, name, slug").in("id", referredShopIds)
      : { data: [] as ReferredShopRow[] };

  const referredShopById = new Map(
    ((referredShopsData ?? []) as ReferredShopRow[]).map((s) => [s.id, s])
  );

  const referralUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/inscription?ref=${shop.slug}`;
  const rewardedCount = referrals.filter((r) => r.rewarded_at).length;

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Parrainage</h1>
      <p className="mt-2 max-w-xl text-sm text-encre/70">
        Partage ton lien avec d&apos;autres vendeurs. Dès qu&apos;un vendeur
        que tu as invité passe sur un plan payant (Business ou Pro), vous
        recevez chacun {REFERRAL_REWARD_DAYS} jours offerts sur votre plan
        actuel — ou un passage gratuit au plan Pro pendant{" "}
        {REFERRAL_REWARD_DAYS} jours si tu es encore sur Starter.
      </p>

      <div className="mt-6 rounded-lg border border-ligne bg-white p-4">
        <h2 className="font-display text-sm font-semibold text-encre">Ton lien de parrainage</h2>
        <p className="mt-1 text-xs text-encre/60">
          À partager par WhatsApp, email ou tout autre moyen — chaque
          inscription via ce lien te sera automatiquement rattachée.
        </p>
        <div className="mt-3">
          <CopyLink url={referralUrl} />
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-ligne bg-white p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-sm font-semibold text-encre">Tes filleuls</h2>
          <p className="text-xs text-encre/50">
            {referrals.length} au total · {rewardedCount} récompensé{rewardedCount > 1 ? "s" : ""}
          </p>
        </div>

        {referrals.length === 0 ? (
          <p className="mt-4 text-sm text-encre/60">
            Aucun vendeur inscrit avec ton lien pour l&apos;instant.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {referrals.map((referral) => {
              const referredShop = referredShopById.get(referral.referred_shop_id);
              return (
                <li
                  key={referral.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-ligne/70 bg-brume/40 p-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-encre">
                      {referredShop?.name ?? "Boutique supprimée"}
                    </p>
                    <p className="text-xs text-encre/50">
                      Inscrit le {new Date(referral.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  {referral.rewarded_at ? (
                    <span className="shrink-0 rounded bg-succes/15 px-1.5 py-0.5 text-xs font-medium text-succes">
                      Récompensé
                    </span>
                  ) : (
                    <span className="shrink-0 rounded bg-sable px-1.5 py-0.5 text-xs text-encre/60">
                      En attente d&apos;un plan payant
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
