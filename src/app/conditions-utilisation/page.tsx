import Link from "next/link";

/**
 * Conditions d'utilisation — créées le 22/09/2026, pour remplacer le lien
 * mort ("#") dans "Mon compte" > section Légal, à la demande d'Isaac lors du
 * nettoyage UX/UI (voir claude/decisions-techniques.md). Même principe que
 * `politique-confidentialite/page.tsx` (créée le 21/09/2026) : contenu
 * fidèle à ce que fait réellement KEVA aujourd'hui (vérifié dans le code et
 * cahier_de_charge.md), pas de clauses génériques inventées.
 *
 * IMPORTANT — à faire relire par un juriste avant publication réelle :
 * - Le nom d'entité (section 1) et le droit applicable (section 11) sont des
 *   placeholders — Isaac n'a pas encore communiqué de raison sociale
 *   officielle ni tranché la juridiction (Côte d'Ivoire par défaut, cohérent
 *   avec le marché ciblé par cahier_de_charge.md, mais à confirmer).
 * - L'email de contact utilisé est celui fourni par Isaac le 22/09/2026
 *   (contactkevashop@gmail.com) — à corriger si une adresse dédiée
 *   (contact@shopkeva.com) est créée plus tard.
 * - Aucun taux de commission n'existe à ce jour dans le modèle (KEVA facture
 *   un abonnement vendeur, pas une commission sur les ventes — voir
 *   decisions-techniques.md, "Refonte complète du système d'abonnements") :
 *   ne pas en ajouter un ici sans vérifier que ça reste vrai.
 *
 * **Section 5 (produits interdits) ajoutée le 22/09/2026** : un futur
 * vendeur a demandé à Isaac, dans le groupe d'accès anticipé, si tout était
 * autorisé à la vente. Sa réponse orale ("du moment que ce n'est pas
 * illégal") était juste dans l'esprit mais rien de concret n'existait nulle
 * part — l'ancienne section 4 se contentait d'un renvoi vague à "la
 * réglementation applicable", et la section suspension (désormais 10)
 * mentionnait des "produits interdits" sans jamais les nommer. Absence de
 * liste = aucune base à opposer à un vendeur de mauvaise foi, et exposition
 * plus directe pour Isaac lui-même vu l'absence de société enregistrée
 * (RCCM) pour KEVA à ce jour (voir decisions-techniques.md, section PawaPay/
 * KYB) — une structure enregistrée aurait pu limiter sa responsabilité
 * personnelle, ce n'est pas le cas ici. Liste non exhaustive volontairement
 * (dernier point générique) : mieux vaut une liste illustrative qu'une
 * énumération fermée qu'un vendeur pourrait exploiter par un vide juridique.
 */
export const metadata = {
  title: "Conditions d'utilisation — KEVA",
};

export default function ConditionsUtilisationPage() {
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
          Conditions d&apos;utilisation
        </h1>
        <p className="mt-2 text-sm text-encre/60">Dernière mise à jour : 22 septembre 2026</p>

        <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed text-encre/80">
          <section>
            <h2 className="font-display text-base font-semibold text-encre">1. Objet</h2>
            <p className="mt-2">
              KEVA (accessible sur shopkeva.com) est une plateforme éditée par
              [raison sociale à préciser] qui permet à des vendeurs de créer
              une boutique en ligne (« la Boutique ») et à leurs clients d&apos;y
              passer commande. En créant un compte ou en passant commande sur
              KEVA, tu acceptes les présentes conditions.
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-encre">2. Qui utilise KEVA</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Le vendeur</strong> : crée et gère sa Boutique (produits,
                commandes, informations affichées aux clients).
              </li>
              <li>
                <strong>Le client</strong> : consulte les boutiques et passe
                commande, avec ou sans compte.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-encre">
              3. Compte et inscription
            </h2>
            <p className="mt-2">
              Un compte client est optionnel : tu peux commander en tant
              qu&apos;invité. Un compte vendeur est nécessaire pour créer une
              Boutique. Tu es responsable de l&apos;exactitude des informations
              fournies (nom, numéro de téléphone, adresse) et de la
              confidentialité de tes identifiants de connexion.
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-encre">
              4. Obligations du vendeur
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Décrire ses produits de façon exacte (prix, disponibilité, photos réelles).</li>
              <li>
                Honorer les commandes reçues et tenir leur statut à jour
                (Payée, En préparation, Livrée, Annulée) pour que le client
                puisse suivre sa commande.
              </li>
              <li>Respecter la réglementation applicable à son activité de vente (produits autorisés à la vente, prix affichés).</li>
              <li>Rester joignable par ses clients, notamment via le numéro WhatsApp renseigné sur sa Boutique.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-encre">
              5. Produits et articles interdits
            </h2>
            <p className="mt-2">
              Il est interdit de proposer à la vente sur KEVA, entre autres :
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Armes à feu, munitions, armes blanches à usage d&apos;agression, explosifs et matières dangereuses.</li>
              <li>Stupéfiants, drogues et leurs précurseurs, quelle que soit la forme.</li>
              <li>Médicaments et produits pharmaceutiques, sauf autorisation officielle en tant que pharmacie ou dépôt agréé.</li>
              <li>Espèces animales ou végétales protégées et leurs dérivés (ivoire, peaux, écailles, etc.).</li>
              <li>Produits contrefaits ou copies non autorisées d&apos;une marque, d&apos;une œuvre ou d&apos;un brevet.</li>
              <li>Biens volés, faux documents, fausse monnaie ou données personnelles/bancaires d&apos;autrui.</li>
              <li>Contenus ou services à caractère pornographique, ou destinés à exploiter des mineurs.</li>
              <li>Organes, restes humains ou animaux, et services de jeux d&apos;argent non autorisés.</li>
              <li>Plus largement, tout produit ou service dont la vente est interdite ou réglementée par la loi ivoirienne ou les conventions internationales applicables.</li>
            </ul>
            <p className="mt-2">
              Un produit signalé ou identifié comme relevant de cette liste
              est retiré, et la Boutique concernée peut être suspendue sans
              préavis (voir section 10).
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-encre">
              6. Obligations du client
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Fournir des informations de livraison exactes et être joignable pour la réception de la commande.</li>
              <li>Régler la commande selon le mode de paiement proposé par KEVA au moment de la commande (paiement à la livraison actuellement ; Mobile Money à venir).</li>
              <li>Laisser des avis sincères sur les produits reçus.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-encre">
              7. Abonnement vendeur
            </h2>
            <p className="mt-2">
              L&apos;accès aux fonctionnalités vendeur (nombre de produits,
              gestion de stock, variantes...) dépend du plan d&apos;abonnement en
              cours (Starter, Business ou Pro). En cas d&apos;abonnement expiré,
              le vendeur dispose d&apos;une période de grâce de 7 jours pour
              renouveler ; passé ce délai, sa Boutique reste visible mais il
              ne peut plus ajouter de nouveaux produits jusqu&apos;au
              renouvellement. Les tarifs en vigueur sont affichés dans l&apos;espace
              vendeur avant toute souscription.
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-encre">
              8. Rôle de KEVA
            </h2>
            <p className="mt-2">
              KEVA fournit l&apos;outil technique permettant au vendeur de
              présenter ses produits et de recevoir des commandes. KEVA
              n&apos;est ni le vendeur, ni transporteur, ni partie au contrat de
              vente conclu entre le vendeur et le client : les questions liées
              à un produit, une livraison ou un paiement à la livraison se
              règlent directement entre le client et le vendeur concerné.
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-encre">
              9. Propriété intellectuelle
            </h2>
            <p className="mt-2">
              Chaque vendeur reste propriétaire des contenus qu&apos;il met en
              ligne (photos, descriptions, logo de sa Boutique) et garantit
              disposer des droits nécessaires pour les publier. La marque et
              le logo KEVA restent la propriété de [raison sociale à
              préciser].
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-encre">
              10. Suspension et résiliation
            </h2>
            <p className="mt-2">
              KEVA peut suspendre ou clôturer un compte en cas de non-respect
              des présentes conditions (informations frauduleuses, produits
              interdits à la vente — voir section 5, abus envers d&apos;autres
              utilisateurs). Tu peux demander la clôture de ton compte à tout
              moment en nous écrivant (voir section 12).
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-encre">
              11. Droit applicable
            </h2>
            <p className="mt-2">
              Les présentes conditions sont régies par le droit ivoirien
              [juridiction à confirmer]. Tout litige sera soumis, à défaut de
              résolution amiable, aux juridictions compétentes de Côte
              d&apos;Ivoire.
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-encre">12. Contact</h2>
            <p className="mt-2">
              Pour toute question sur ces conditions :{" "}
              <a href="mailto:contactkevashop@gmail.com" className="text-vert-actif underline">
                contactkevashop@gmail.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-semibold text-encre">
              13. Modifications
            </h2>
            <p className="mt-2">
              Ces conditions peuvent évoluer avec la plateforme. La date de
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
