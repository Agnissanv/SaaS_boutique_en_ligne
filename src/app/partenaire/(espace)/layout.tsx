import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { SpaceSwitcher } from "@/components/space-switcher";
import { PartnerNav } from "./partner-nav";
import { formatDay, getMyPartner } from "./data";

export const metadata: Metadata = {
  title: "Espace partenaire",
  robots: { index: false, follow: false },
};

/**
 * Espace partenaire (13/10/2026, programme partenaire influenceur — voir
 * supabase/migrations/0061_partner_program.sql). Même cadre que le tableau
 * de bord vendeur (sidebar verte sur ordinateur, barre verte sur téléphone)
 * pour qu'elle se sente dans le même compte, avec le sélecteur « Ma boutique
 * | Partenaire » toujours visible en haut.
 *
 * Partenariat terminé : l'espace reste consultable (historique, dernier
 * paiement dû), signalé par un bandeau ; rien n'est supprimé.
 */
export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const partner = await getMyPartner();

  return (
    <div className="flex min-h-screen bg-brume">
      <aside className="hidden w-60 shrink-0 flex-col bg-vert-sapin text-ivoire md:flex">
        <Link href="/partenaire" className="flex items-center gap-2 px-4 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo statique */}
          <img src="/keva-logo.jpg" alt="KEVA" className="h-8 w-8 rounded object-cover" />
          <span className="font-display text-lg font-bold tracking-wide">KEVA</span>
        </Link>
        <div className="px-3">
          <SpaceSwitcher active="partenaire" />
        </div>
        <PartnerNav variant="sidebar" />
        <div className="border-t border-white/10 px-3 py-3 text-sm">
          <form action={signOut}>
            <button
              type="submit"
              className="block w-full rounded-md px-3 py-2 text-left text-ivoire/70 underline hover:bg-white/5 hover:text-ivoire"
            >
              Déconnexion
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="bg-vert-sapin px-3 pb-3 pt-2 text-ivoire md:hidden">
          <div className="flex items-center justify-between">
            <Link href="/partenaire" className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- logo statique */}
              <img src="/keva-logo.jpg" alt="KEVA" className="h-7 w-7 rounded object-cover" />
              <span className="font-display text-base font-bold tracking-wide">KEVA</span>
            </Link>
            <form action={signOut}>
              <button type="submit" className="text-xs text-ivoire/70 underline">
                Déconnexion
              </button>
            </form>
          </div>
          <div className="mt-2">
            <SpaceSwitcher active="partenaire" />
          </div>
        </div>
        <div className="md:hidden">
          <PartnerNav variant="tabs" />
        </div>

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
          {!partner.isActive && (
            <p className="mb-5 rounded-lg border border-ligne bg-white p-3 text-sm text-encre/80">
              {partner.endsOn
                ? `Ton partenariat est terminé depuis le ${formatDay(partner.endsOn)}.`
                : `Ton partenariat commence le ${formatDay(partner.startsOn)}.`}{" "}
              Ton espace reste consultable, mais tes liens et ton code ne rapportent pas de
              commission pour l&apos;instant.
            </p>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
