import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CURRENT_SELLER_CHARTER_VERSION, SELLER_CHARTER_SECTIONS } from "@/lib/seller-charter";
import { acceptSellerCharter } from "./actions";

export const metadata = {
  title: "Règles de la plateforme — KEVA",
};

/**
 * Règles de la plateforme (page/route encore nommée "charte-vendeur" en
 * interne, voir plus bas) — créée le 22/09/2026 à la demande d'Isaac, suite à
 * la question d'un futur vendeur sur les produits autorisés/interdits dans
 * le groupe d'accès anticipé. Les règles existaient déjà dans les conditions
 * d'utilisation (section 5, ajoutée le même jour), mais un lien en bas de
 * page n'est pas lu par la plupart des vendeurs — Isaac voulait une étape
 * obligatoire, lue et validée explicitement, avant de pouvoir continuer
 * vers le dashboard/la création de boutique.
 *
 * **Libellé "Charte vendeur" renommé "Règles de la plateforme" le
 * 22/09/2026** : Isaac a jugé "charte" trop compliqué/juridique pour ses
 * vendeurs. Changement purement d'affichage (titre, lien sidebar/Aide) —
 * route, noms de fichiers/fonctions et colonnes en base (`shop_charter_*`,
 * `seller-charter.ts`, `/charte-vendeur`) inchangés pour éviter une
 * migration/renommage de fichiers sans bénéfice utilisateur.
 *
 * Page volontairement HORS du groupe (vendor)/dashboard : `dashboard/layout.tsx`
 * redirige ici tant que la charte n'est pas acceptée (voir ce fichier) — si
 * cette page vivait sous /dashboard, elle passerait par ce même layout et se
 * redirigerait donc elle-même en boucle infinie.
 *
 * Case à cocher en HTML natif (`required`) plutôt qu'un Client Component
 * avec état : le navigateur bloque déjà la soumission tant qu'elle n'est
 * pas cochée, aucun JS necessaire pour ça.
 *
 * Un compte qui a déjà accepté la version courante peut revenir ici à tout
 * moment (lien dans "Aide" et le pied de la sidebar) pour relire le
 * contenu — la case et le bouton ne sont alors plus affichés, juste un
 * rappel de la date d'acceptation et un retour au dashboard.
 */
export default async function SellerCharterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/connexion");

  const { data: profile } = await supabase
    .from("profiles")
    .select("shop_charter_accepted_at, shop_charter_version")
    .eq("id", user.id)
    .maybeSingle();

  const alreadyAccepted =
    !!profile?.shop_charter_accepted_at &&
    (profile.shop_charter_version ?? 0) >= CURRENT_SELLER_CHARTER_VERSION;

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
        <h1 className="font-display text-2xl font-semibold text-encre">Règles de la plateforme</h1>
        <p className="mt-2 text-sm text-encre/70">
          {alreadyAccepted
            ? `Acceptée le ${new Date(profile!.shop_charter_accepted_at!).toLocaleDateString("fr-FR")}. Voici un rappel des règles de la plateforme.`
            : "Avant de continuer, prends deux minutes pour lire les règles de la plateforme."}
        </p>

        <div className="mt-8 flex flex-col gap-6">
          {SELLER_CHARTER_SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="font-display text-base font-semibold text-encre">{section.title}</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-encre/80">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}

          <section>
            <h2 className="font-display text-base font-semibold text-encre">Besoin d&apos;aide ?</h2>
            <p className="mt-2 text-sm leading-relaxed text-encre/80">
              Une question sur une règle ou sur ta boutique ? Écris-nous à{" "}
              <a href="mailto:contactkevashop@gmail.com" className="text-vert-actif underline">
                contactkevashop@gmail.com
              </a>{" "}
              ou consulte la page{" "}
              <Link href="/dashboard/aide" className="text-vert-actif underline">
                Aide
              </Link>{" "}
              du dashboard.
            </p>
          </section>
        </div>

        <p className="mt-6 text-sm text-encre/60">
          Le détail complet des règles de la plateforme est dans les{" "}
          <Link href="/conditions-utilisation" className="text-vert-actif underline">
            conditions d&apos;utilisation
          </Link>
          .
        </p>

        {alreadyAccepted ? (
          <Link
            href="/dashboard"
            className="mt-8 inline-block rounded-md bg-vert-actif px-4 py-2 text-sm font-medium text-ivoire hover:bg-vert-sapin"
          >
            Retour au dashboard
          </Link>
        ) : (
          <form action={acceptSellerCharter} className="mt-8 flex flex-col gap-4">
            <label className="flex items-start gap-2 text-sm text-encre">
              <input
                type="checkbox"
                required
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-ligne text-vert-actif focus:ring-vert-actif"
              />
              J&apos;ai lu et j&apos;accepte de respecter ces règles.
            </label>
            <button
              type="submit"
              className="self-start rounded-md bg-vert-actif px-4 py-2 text-sm font-medium text-ivoire hover:bg-vert-sapin"
            >
              Continuer
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
