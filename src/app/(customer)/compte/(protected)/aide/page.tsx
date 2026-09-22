const FAQ: { question: string; answer: string }[] = [
  {
    question: "Comment suivre ma commande ?",
    answer:
      "Depuis « Mon compte » > « Mes commandes », tu retrouves toutes tes commandes avec leur statut : En attente, Payée, En préparation, Livrée ou Annulée. Tu reçois aussi une notification (visible dans la cloche en haut de l'app) à chaque changement de statut.",
  },
  {
    question: "Comment se passe le paiement ?",
    answer:
      "Pour l'instant, le paiement se fait à la livraison, en espèces directement auprès du livreur ou du vendeur. Le paiement Mobile Money (Wave, Orange Money...) arrivera dès que l'intégration sera activée sur KEVA.",
  },
  {
    question: "Dois-je créer un compte pour commander ?",
    answer:
      "Non, tu peux commander en tant qu'invité avec juste ton nom, ton numéro et ton adresse de livraison. Si tu crées un compte ensuite avec le même numéro, tes anciennes commandes s'y rattachent automatiquement (ou via le bouton dédié dans « Mon compte » si besoin).",
  },
  {
    question: "Comment contacter le vendeur d'un produit ?",
    answer:
      "Sur la page de la boutique ou de la fiche produit, un bouton « Contacter sur WhatsApp » (quand le vendeur l'a renseigné) t'amène directement dans une discussion avec lui.",
  },
  {
    question: "Comment annuler ou modifier ma commande ?",
    answer:
      "KEVA ne gère pas encore l'annulation directement depuis le compte client : contacte le vendeur au plus vite sur WhatsApp, avant que la commande ne passe en préparation.",
  },
  {
    question: "Comment laisser un avis sur un produit ?",
    answer:
      "Une fois ta commande marquée « Livrée », tu peux laisser un avis sur les produits reçus depuis le suivi de cette commande.",
  },
  {
    question: "Une question qui n'est pas ici ?",
    answer: "Écris-nous directement — voir « Nous contacter » dans Aide & Support.",
  },
];

/**
 * Centre d'aide client — créé le 22/09/2026 pour remplacer le lien mort
 * "Centre d'aide" (href="#") de la page Mon compte (voir page.tsx du dossier
 * parent). Même principe que la FAQ statique du dashboard vendeur
 * (dashboard/aide/page.tsx) : questions ancrées dans ce que fait réellement
 * l'app aujourd'hui (paiement à la livraison uniquement, statuts de commande
 * réels de src/lib/orders.ts, commande invité + rattachement par téléphone
 * de claim-orders-button.tsx) plutôt que des réponses génériques.
 */
export default function CustomerHelpPage() {
  return (
    <div className="mx-auto w-full max-w-lg">
      <h1 className="font-display text-lg font-semibold text-encre">Centre d&apos;aide</h1>
      <p className="mt-2 text-sm text-encre/70">
        Questions fréquentes sur tes commandes et ton compte.
      </p>

      <div className="mt-6 divide-y divide-ligne rounded-xl border border-ligne bg-white px-4">
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
