import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AcceptInvitationForm } from "./accept-form";

export const metadata: Metadata = {
  title: "Invitation partenaire",
  robots: { index: false, follow: false },
};

type Invitation = {
  label: string;
  business_commission: number;
  pro_commission: number;
  starts_on: string;
  expired: boolean;
};

/**
 * Page d'invitation partenaire (13/10/2026) — ouverte depuis le lien envoyé
 * par Isaac sur WhatsApp. Trois cas : invitation introuvable/expirée ;
 * visiteur non connecté (créer un compte ou se connecter, retour ici
 * ensuite via `?suite=`) ; connecté (formulaire d'acceptation).
 */
export default async function PartnerInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const [{ data: invitationData }, { data: auth }] = await Promise.all([
    supabase.rpc("get_partner_invitation", { p_token: token }),
    supabase.auth.getUser(),
  ]);
  const invitation = invitationData as Invitation | null;
  const user = auth.user;

  // Déjà partenaire (invitation acceptée puis lien rouvert) : direction l'espace.
  if (user) {
    const { data: ownPartner } = await supabase.from("partners").select("id").eq("profile_id", user.id).maybeSingle();
    if (ownPartner) redirect("/partenaire");
  }

  const selfPath = `/partenaire/invitation/${encodeURIComponent(token)}`;
  const fcfa = (amount: number) => `${amount.toLocaleString("fr-FR")} F`;

  let body: React.ReactNode;
  if (!invitation) {
    body = (
      <p className="mt-3 text-sm text-encre/70">
        Cette invitation n&apos;existe pas ou a déjà été utilisée. Si tu penses que c&apos;est une
        erreur, demande un nouveau lien à KEVA.
      </p>
    );
  } else if (invitation.expired) {
    body = (
      <p className="mt-3 text-sm text-encre/70">
        Cette invitation a expiré (elle reste valable 7 jours). Demande un nouveau lien à KEVA.
      </p>
    );
  } else {
    body = (
      <>
        <p className="mt-2 text-sm text-encre/70">
          KEVA t&apos;invite à rejoindre son programme partenaire. Tu fais connaître KEVA à ta
          communauté, et tu gagnes une commission chaque mois :
        </p>
        <ul className="mt-3 space-y-1.5 rounded-lg bg-brume p-3 text-sm text-encre">
          <li>
            <span className="font-semibold">{fcfa(invitation.business_commission)} / mois</span> par
            abonnement Business actif
          </li>
          <li>
            <span className="font-semibold">{fcfa(invitation.pro_commission)} / mois</span> par
            abonnement Pro actif
          </li>
          <li>Une boutique Pro offerte pendant tout le partenariat</li>
        </ul>

        {user ? (
          <AcceptInvitationForm
            token={token}
            defaultName={(user.user_metadata?.display_name as string | undefined) ?? ""}
          />
        ) : (
          <div className="mt-5 flex flex-col gap-2">
            <Link
              href={`/inscription?suite=${encodeURIComponent(selfPath)}`}
              className="rounded-md bg-vert-actif px-4 py-2.5 text-center text-sm font-medium text-ivoire hover:bg-vert-sapin"
            >
              Créer mon compte
            </Link>
            <Link
              href={`/connexion?suite=${encodeURIComponent(selfPath)}`}
              className="rounded-md border border-ligne px-4 py-2.5 text-center text-sm font-medium text-encre hover:bg-brume"
            >
              J&apos;ai déjà un compte KEVA
            </Link>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center bg-brume px-4 py-10">
      <Link href="/" className="mx-auto mb-6 flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- logo statique */}
        <img src="/keva-logo.jpg" alt="KEVA" className="h-10 w-10 rounded-md object-cover" />
        <span className="font-display text-xl font-bold tracking-wide text-vert-sapin">KEVA</span>
      </Link>
      <div className="rounded-xl border border-ligne bg-white p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-vert-actif">Programme partenaire</p>
        <h1 className="mt-1 font-display text-xl font-semibold text-encre">
          {invitation && !invitation.expired ? "Bienvenue chez KEVA" : "Invitation partenaire"}
        </h1>
        {body}
      </div>
    </div>
  );
}
