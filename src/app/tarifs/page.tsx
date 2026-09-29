import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPlanFeatureList } from "@/lib/plan-features";

export const metadata = {
  title: "Tarifs — KEVA",
  description:
    "Les 3 plans d'abonnement vendeur KEVA : ce qui est inclus et leur prix en FCFA. 0% commission cachée, 1 mois d'essai Pro offert à l'ouverture de ta boutique.",
};

type Plan = {
  id: string;
  code: string;
  name: string;
  price: number;
  duration_days: number;
  features: Record<string, unknown> | string[] | null;
};

/**
 * Page publique "Tarifs" — créée le 29/09/2026, à la demande d'Isaac : des
 * personnes découvrant KEVA lui ont remonté ne trouver nulle part le prix
 * des plans avant de s'inscrire (voir la question posée juste avant dans
 * cette conversation — vérifiée point par point : aucune mention de tarif
 * sur `/`, `/inscription` ou `/charte-vendeur` avant ce jour). Les seuls
 * vrais tarifs existaient déjà, mais uniquement derrière connexion sur
 * `/dashboard/abonnement`.
 *
 * Route volontairement PUBLIQUE, hors de `(vendor)/dashboard` : lit
 * `subscription_plans` directement (policy RLS `subscription_plans_public_read`,
 * `using (true)` — voir migration 0001), pas besoin d'un compte pour voir
 * cette table, elle ne contient aucune donnée par boutique.
 *
 * Réutilise la même logique d'affichage que `/dashboard/abonnement`
 * (`@/lib/plan-features`, extrait le même jour) pour que les libellés des
 * fonctionnalités soient identiques aux deux endroits — sans le bouton
 * "Passer à ce plan" (paiement Nyole, qui suppose déjà une boutique) ni la
 * mention "plan actuel" (pas de compte connecté ici) : un simple CTA
 * "Ouvrir ma boutique" par plan, qui mène à l'inscription — le choix de plan
 * réel se fait ensuite depuis le dashboard, exactement comme aujourd'hui.
 *
 * Les deux avantages annoncés en tête de page reprennent des faits déjà
 * établis ailleurs dans l'app plutôt que d'inventer un argumentaire :
 * "0% commission cachée" (bannière déjà validée par Isaac, voir
 * promotions-section.tsx et claude/affiches-et-posts-lancement.md) et le
 * mois d'essai Pro offert à toute nouvelle boutique (`start_free_subscription`,
 * migration 0029 — inconditionnel, pas une promotion limitée dans le temps).
 */
export default async function TarifsPage() {
  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("subscription_plans")
    .select("id, code, name, price, duration_days, features")
    .order("price", { ascending: true });

  return (
    <div className="min-h-screen bg-brume">
      <header className="border-b border-ligne bg-white px-4 py-4">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo statique */}
            <img src="/keva-logo.jpg" alt="KEVA" className="h-8 w-8 rounded-md object-cover" />
            <span className="font-display text-lg font-bold tracking-wide text-vert-sapin">KEVA</span>
          </Link>
          <Link href="/" className="text-sm text-encre/60 hover:text-vert-actif">
            Marketplace
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-14">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-vert-actif">
            Vendeurs
          </p>
          <h1 className="mt-3 text-balance font-display text-3xl font-black leading-tight text-encre sm:text-4xl">
            Des tarifs simples, sans surprise
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-encre/70">
            0% commission cachée : KEVA facture un abonnement fixe, jamais un
            pourcentage sur tes ventes — ton lien, tes prix, ta marge restent
            à toi. Chaque nouvelle boutique démarre avec un mois d&apos;essai
            Pro offert, toutes fonctionnalités incluses.
          </p>
          <div className="mt-6">
            <Link
              href="/inscription"
              className="inline-flex items-center gap-2 rounded-lg bg-vert-actif px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(28,107,74,0.28)] transition hover:bg-vert-sapin"
            >
              Ouvrir ma boutique
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(plans as Plan[] | null)?.map((plan) => {
            const items = getPlanFeatureList(plan.features);
            return (
              <div
                key={plan.id}
                className="flex flex-col rounded-2xl border border-ligne bg-white p-5"
              >
                <p className="font-display text-base font-semibold text-encre">{plan.name}</p>
                <p className="mt-2">
                  {plan.price > 0 ? (
                    <>
                      <span className="font-mono text-2xl font-semibold text-vert-actif">
                        {plan.price.toLocaleString("fr-FR")}
                      </span>
                      <span className="ml-1 text-sm text-encre/60">FCFA</span>
                    </>
                  ) : (
                    <span className="font-display text-2xl font-semibold text-succes">Gratuit</span>
                  )}
                </p>
                <p className="text-xs text-encre/50">/ {plan.duration_days} jours</p>

                {items.length > 0 && (
                  <ul className="mt-4 flex-1 space-y-1.5 text-sm text-encre/70">
                    {items.map((item, index) => (
                      <li key={index} className="flex gap-2">
                        <span className="text-vert-actif" aria-hidden="true">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <Link
                  href="/inscription"
                  className="mt-5 rounded-lg border border-vert-sapin/25 bg-white px-4 py-2.5 text-center text-sm font-medium text-vert-sapin transition hover:border-vert-actif hover:text-vert-actif"
                >
                  Ouvrir ma boutique
                </Link>
              </div>
            );
          })}
        </div>

        <p className="mt-10 max-w-2xl text-sm text-encre/60">
          Le paiement à la livraison reste le seul mode de paiement client
          actif — aucun frais de transaction supplémentaire côté KEVA. Tu
          peux changer de plan à tout moment depuis ton tableau de bord, une
          fois ta boutique créée.{" "}
          <Link href="/conditions-utilisation" className="text-vert-actif underline">
            Voir les conditions d&apos;utilisation
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
