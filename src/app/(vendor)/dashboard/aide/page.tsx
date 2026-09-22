import Link from "next/link";

const FAQ: { question: string; answer: string }[] = [
  {
    question: "Comment ajouter un produit ?",
    answer:
      "Depuis « Produits », clique sur « Ajouter un produit ». Tu peux aussi dupliquer un produit existant très proche (bouton « Dupliquer ») pour ne pas tout ressaisir : il ne restera plus qu'à changer les photos et éventuellement le nom.",
  },
  {
    question: "Comment mes clients me contactent-ils ?",
    answer:
      "Renseigne ton numéro WhatsApp dans « Ma boutique » : un bouton « Contacter sur WhatsApp » apparaît alors automatiquement sur ta boutique et tes fiches produit.",
  },
  {
    question: "Comment fonctionne le paiement ?",
    answer:
      "Pour l'instant, seul le paiement à la livraison est disponible : le client te règle en espèces à la remise de la commande. Le paiement Mobile Money (Wave, Orange Money...) arrivera dès que l'intégration sera validée.",
  },
  {
    question: "Où voir l'argent que j'ai déjà encaissé ?",
    answer:
      "La page « Paiements » récapitule les commandes livrées (encaissées) et celles encore en attente de livraison.",
  },
  {
    question: "Que se passe-t-il si mon abonnement expire ?",
    answer:
      "Tu gardes un accès complet pendant une période de grâce de 7 jours après l'expiration. Passé ce délai, tu ne peux plus ajouter de nouveaux produits, mais ta boutique reste visible et tu peux toujours gérer tes produits et commandes existants. Renouvelle depuis « Abonnement ».",
  },
  {
    question: "Comment désactiver plusieurs produits d'un coup ?",
    answer:
      "Depuis « Produits », coche les produits concernés (ou « Tout sélectionner ») puis clique sur « Activer » ou « Désactiver » — utile en fin de collection ou en cas de rupture fournisseur.",
  },
  {
    question: "Comment exporter mes commandes ?",
    answer:
      "Depuis « Commandes », clique sur « Exporter en CSV » pour télécharger la liste complète, utilisable dans Excel ou Google Sheets.",
  },
  {
    question: "Un client a laissé un avis, où le voir ?",
    answer:
      "Tous les avis reçus sur tes produits sont regroupés dans « Avis », y compris ceux sur un produit que tu as temporairement désactivé.",
  },
];

/**
 * Page "Aide" — créée le 15/09/2026, manque identifié dans l'analyse du
 * dashboard vendeur (aucune page d'aide/support n'existait). Volontairement
 * une FAQ statique pour l'instant, SANS numéro/email de support inventé :
 * aucun contact officiel de support n'existe encore dans le projet (vérifié
 * dans le code et les docs). Isaac pourra fournir un numéro WhatsApp ou un
 * email de support à ajouter ici dans un prochain passage — voir
 * claude/decisions-techniques.md.
 *
 * **Lien vers les règles de KEVA ajouté le 22/09/2026** : Isaac voulait que
 * les règles acceptées à l'inscription (voir /charte-vendeur et
 * src/lib/seller-charter.ts) restent faciles à retrouver plus tard sur le
 * site, pas seulement lues une fois puis oubliées. Deuxième emplacement : le
 * pied de la sidebar/du tiroir mobile (dashboard/layout.tsx). Libellé
 * renommé deux fois le même jour ("Charte vendeur" → "Règles de la
 * plateforme" → "Règles de KEVA", Isaac ayant ensuite repéré l'usage
 * répété du mot générique "plateforme" à la place du nom KEVA sur le site)
 * — voir la note dans charte-vendeur/page.tsx pour le détail.
 */
export default function HelpPage() {
  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Aide</h1>
      <p className="mt-2 text-sm text-encre/70">
        Questions fréquentes sur l&apos;utilisation de ta boutique.
      </p>

      <Link
        href="/charte-vendeur"
        className="mt-4 inline-block text-sm text-vert-actif underline"
      >
        Relire les règles de KEVA
      </Link>

      <div className="mt-6 max-w-2xl divide-y divide-ligne">
        {FAQ.map((item, index) => (
          <details key={index} className="group py-3">
            <summary className="cursor-pointer text-sm font-medium text-encre hover:text-vert-sapin">
              {item.question}
            </summary>
            <p className="mt-2 text-sm text-encre/70">{item.answer}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
