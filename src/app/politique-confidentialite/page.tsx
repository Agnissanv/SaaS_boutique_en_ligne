import Link from "next/link";

/**
 * Politique de confidentialité — créée le 21/09/2026, dans l'urgence : Google
 * exige une URL de politique de confidentialité pour publier l'application
 * OAuth ("Continuer avec Google") en production (sinon connexion limitée aux
 * comptes de test ajoutés manuellement, 100 max). Le lien existait déjà comme
 * stub (`href="#"`) dans "Mon compte" > section Légal — jamais construit,
 * volontairement, faute de contact support officiel (voir
 * decisions-techniques.md, "Contact support réel" — toujours en attente
 * qu'Isaac fournisse un numéro/email dédié).
 *
 * IMPORTANT — à relire avant publication réelle : le nom d'entité ci-dessous
 * était un espace réservé, réglé le 22/09/2026 comme dans
 * `conditions-utilisation/page.tsx` (même raisonnement, voir ce fichier) :
 * KEVA n'ayant pas de société enregistrée, l'entité citée est Isaac
 * lui-même en tant qu'exploitant individuel — à remplacer par la raison
 * sociale officielle une fois KEVA immatriculée. Contenu par ailleurs fidèle
 * aux données réellement collectées et aux prestataires réellement utilisés
 * par KEVA à ce jour (Supabase, Brevo, Google OAuth, CinetPay une fois
 * activé) — pas de mentions génériques inventées.
 *
 * Révisée le 23/09/2026 : Google a refusé la validation du branding OAuth
 * ("Continuer avec Google") en signalant cette page comme n'ayant "pas
 * suffisamment de contenu". En relisant la politique développeur Google
 * (OAuth API Verification FAQ / Google API Services User Data Policy), le
 * vrai problème n'était pas la longueur mais une mention obligatoire absente :
 * toute politique de confidentialité d'une appli utilisant Google Sign-In
 * doit citer explicitement la "Google API Services User Data Policy" —
 * ajouté ci-dessous en section 5. Deux autres sections standards attendues
 * par ce type de contrôle ajoutées au passage (sécurité des données,
 * mineurs), sincèrement utiles indépendamment de la validation Google.
 * Email de contact basculé sur `contact@shopkeva.com` (Brevo/DNS finalisés
 * le 23/09/2026 — plus besoin du Gmail personnel d'Isaac en repli).
 */
export const metadata = {
  title: "Politique de confidentialité — KEVA",
};

export default function PolitiqueConfidentialitePage() {
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
        <h1 className="font-display text-2xl font-semibold text-encre">
          Politique de confidentialité
        </h1>
        <p className="mt-2 text-sm text-encre/60">Dernière mise à jour : 23 septembre 2026</p>

        <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed text-encre/80">
          <section>
            <h2 className="font-display text-base font-semibold text-encre">1. Qui sommes-nous</h2>
            <p className="mt-2">
              KEVA (accessible sur shopkeva.com) est une plateforme qui permet à
              des vendeurs de créer une boutique en ligne et à leurs clients d&apos;y
              passer commande. KEVA est éditée par Agnissan Isaac Valen,
              exploitant individuel (KEVA n&apos;est pas encore immatriculée en
              tant que société), joignable à l&apos;adresse indiquée à la section
              8 ci-dessous.
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-encre">
              2. Données que nous collectons
            </h2>
            <p className="mt-2">Selon ton usage de KEVA, nous collectons :</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Pour passer une commande (avec ou sans compte) : nom, numéro de
                téléphone, adresse de livraison, et éventuellement une adresse
                email et ta position GPS si tu choisis de la partager.
              </li>
              <li>
                Pour créer un compte (client ou vendeur) : nom, email et/ou
                numéro de téléphone, et, si tu utilises « Continuer avec
                Google », les informations transmises par Google (nom, email,
                photo de profil).
              </li>
              <li>
                Pour un compte vendeur : en plus, les informations de la
                boutique (nom, description, logo, numéro WhatsApp) et les
                produits mis en ligne.
              </li>
              <li>
                Automatiquement : les commandes passées, leur statut, et les
                avis laissés sur les produits reçus.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-encre">
              3. Pourquoi nous utilisons ces données
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Traiter et livrer tes commandes, et te tenir informé de leur statut.</li>
              <li>Créer et sécuriser ton compte, et te permettre de retrouver tes commandes.</li>
              <li>T&apos;envoyer des notifications liées à tes commandes (par email et dans ton espace de notification).</li>
              <li>Permettre aux vendeurs de gérer leur boutique et de te contacter au sujet d&apos;une commande.</li>
              <li>Améliorer KEVA et assurer sa sécurité (prévenir la fraude, les abus).</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-encre">
              4. Partage avec des tiers
            </h2>
            <p className="mt-2">
              Nous ne vendons aucune donnée. Certaines données transitent
              nécessairement par des prestataires techniques, qui n&apos;ont le
              droit de les utiliser que pour nous rendre ce service :
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Supabase</strong> (hébergement de la base de données et de
                l&apos;authentification).
              </li>
              <li>
                <strong>Brevo</strong> (envoi des emails automatiques liés à tes
                commandes et à ton compte).
              </li>
              <li>
                <strong>Google</strong> (uniquement si tu choisis « Continuer avec
                Google » pour te connecter).
              </li>
              <li>
                <strong>CinetPay</strong> (traitement des paiements Mobile Money,
                une fois cette option activée sur KEVA).
              </li>
              <li>
                Le vendeur auprès duquel tu commandes, pour les seules
                informations nécessaires à traiter ta commande (nom, téléphone,
                adresse de livraison).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-encre">
              5. Utilisation des données de ton compte Google
            </h2>
            <p className="mt-2">
              Si tu choisis « Continuer avec Google » pour te connecter ou
              créer ton compte, KEVA reçoit uniquement ton nom, ton adresse
              email et ta photo de profil Google — rien d&apos;autre (ni tes
              contacts, ni ton agenda, ni tes fichiers). Ces informations
              servent exclusivement à créer et reconnaître ton compte KEVA :
              elles ne sont jamais utilisées à des fins publicitaires, jamais
              revendues, et jamais partagées avec un tiers en dehors des cas
              déjà décrits à la section 4. L&apos;utilisation par KEVA des
              informations reçues des API Google respecte la{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-vert-actif underline"
              >
                Google API Services User Data Policy
              </a>
              , y compris ses exigences de « Limited Use ».
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-encre">
              6. Cookies et stockage local
            </h2>
            <p className="mt-2">
              KEVA utilise le stockage local de ton navigateur (pas de cookies
              publicitaires ni de traceurs tiers) pour te permettre de garder
              ton panier et tes préférences (produits vus récemment, favoris)
              d&apos;une visite à l&apos;autre.
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-encre">
              7. Sécurité des données
            </h2>
            <p className="mt-2">
              Tes données sont hébergées chez Supabase, chiffrées en transit
              (HTTPS) entre ton appareil et nos serveurs. L&apos;accès à la base
              de données est restreint par des règles de sécurité au niveau
              des lignes (Row Level Security) : un vendeur ne peut voir que
              les commandes de sa propre boutique, un client que les siennes.
              Aucun système n&apos;étant infaillible, nous ne pouvons cependant
              pas garantir une sécurité absolue.
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-encre">
              8. Mineurs
            </h2>
            <p className="mt-2">
              KEVA ne s&apos;adresse pas aux enfants et ne collecte pas
              sciemment de données concernant des mineurs. Si tu penses qu&apos;un
              enfant nous a transmis des données personnelles, contacte-nous
              (section 11) afin que nous les supprimions.
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-encre">
              9. Durée de conservation
            </h2>
            <p className="mt-2">
              Tes données sont conservées tant que ton compte existe. Les
              commandes passées en tant qu&apos;invité (sans compte) sont
              conservées le temps nécessaire à leur traitement et au suivi
              après-vente. Tu peux demander la suppression de tes données à
              tout moment (voir section 10).
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-encre">10. Tes droits</h2>
            <p className="mt-2">
              Tu peux à tout moment demander à consulter, corriger ou faire
              supprimer les données te concernant, en nous écrivant à l&apos;adresse
              indiquée ci-dessous. Tu peux aussi modifier directement tes
              informations personnelles depuis ton espace compte.
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-encre">11. Contact</h2>
            <p className="mt-2">
              Pour toute question sur cette politique ou sur tes données :{" "}
              <a href="mailto:contact@shopkeva.com" className="text-vert-actif underline">
                contact@shopkeva.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-encre">
              12. Modifications
            </h2>
            <p className="mt-2">
              Cette politique peut évoluer avec KEVA. La date de
              dernière mise à jour est indiquée en haut de cette page.
            </p>
          </section>
        </div>

        <Link href="/" className="mt-10 inline-block text-sm text-vert-actif underline">
          Retour à l&apos;accueil
        </Link>
      </main>
    </div>
  );
}
