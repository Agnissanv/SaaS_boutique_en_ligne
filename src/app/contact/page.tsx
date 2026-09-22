import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ContactForm } from "./contact-form";

export const metadata = {
  title: "Nous contacter — KEVA",
};

const SUBJECT_BY_PARAM: Record<string, string> = {
  avis: "Avis sur KEVA",
};

/**
 * Page "Nous contacter" — créée le 22/09/2026, remplace le lien
 * mailto:contactkevashop@gmail.com utilisé jusque-là depuis "Mon compte"
 * (voir decisions-techniques.md, "Nettoyage UX/UI"). Isaac a préféré un vrai
 * formulaire in-app à un mailto : sur mobile/PWA, un mailto fait sortir le
 * client vers une appli mail — parfois même absente sur l'appareil — ce qui
 * contredit le chantier "langage natif" (globals.css, 15/09/2026). Le
 * message part par email (Brevo, déjà branché pour les commandes) plutôt que
 * dans un vrai système de tickets admin, jugé prématuré pour l'instant.
 *
 * Volontairement PUBLIQUE (pas sous compte/(protected)) : quelqu'un bloqué
 * hors de son compte, ou un client invité sans compte, doit pouvoir joindre
 * le support — comme avec l'ancien mailto, qui ne demandait pas non plus de
 * connexion.
 *
 * `?sujet=avis` présélectionne "Avis sur KEVA" dans le formulaire : le lien
 * "Donner un avis" de la page Mon compte pointe ici plutôt que de garder son
 * propre mailto séparé, pour ne pas avoir deux façons différentes (un
 * formulaire ET un mailto) de joindre la même adresse de support.
 */
export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ sujet?: string }>;
}) {
  const { sujet } = await searchParams;
  const defaultSubject = (sujet && SUBJECT_BY_PARAM[sujet]) || "Question générale";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let defaultName = "";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();
    defaultName = profile?.display_name ?? "";
  }
  const defaultEmail = user?.email ?? "";

  return (
    <div className="min-h-screen bg-brume">
      <header className="border-b border-ligne bg-white px-4 py-4">
        <Link href="/" className="mx-auto flex w-full max-w-2xl items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo statique */}
          <img src="/keva-logo.jpg" alt="KEVA" className="h-8 w-8 rounded-md object-cover" />
          <span className="font-display text-lg font-bold tracking-wide text-vert-sapin">KEVA</span>
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-10">
        <h1 className="font-display text-2xl font-semibold text-encre">Nous contacter</h1>
        <p className="mt-2 text-sm text-encre/70">
          Une question, un souci avec une commande, ou un avis sur KEVA ?
          Écris-nous, on te répond directement par email.
        </p>

        <ContactForm
          defaultName={defaultName}
          defaultEmail={defaultEmail}
          defaultSubject={defaultSubject}
        />

        <Link href="/" className="mt-10 inline-block text-sm text-vert-actif underline">
          Retour à l&apos;accueil
        </Link>
      </main>
    </div>
  );
}
