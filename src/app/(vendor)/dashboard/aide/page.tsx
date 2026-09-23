"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type FaqItem = {
  question: string;
  answer: string;
  /**
   * Lien YouTube optionnel — pas encore utilisé (23/09/2026) : Isaac va
   * tourner des tutos vidéo sur la chaîne YouTube de KEVA et les intégrer un
   * par un une fois prêts, pour les questions où une explication écrite
   * suffit moins bien qu'une démonstration. Le champ existe déjà pour que ce
   * jour-là, ajouter une vidéo à une question soit un simple ajout de ligne
   * ici, sans toucher au composant. Aucune valeur pour l'instant — voir
   * decisions-techniques.md.
   */
  videoUrl?: string;
};
type FaqCategory = { title: string; items: FaqItem[] };

/**
 * FAQ enrichie le 23/09/2026 (demande d'Isaac : les vendeurs doivent pouvoir
 * comprendre "certaines choses" par eux-mêmes avant de nous contacter,
 * FAQ initiale jugée trop courte). Passée de 8 questions en vrac à ~25
 * organisées par thème, une question par vraie fonctionnalité existante du
 * dashboard — jamais un fonctionnement inventé. Vérifié fichier par fichier
 * (shop-form.tsx, product-form.tsx, subscription.ts, migrations 0016/0025/
 * 0029/0041/0042/0044...) avant d'écrire chaque réponse, notamment pour les
 * limites par plan (Starter/Business/Pro) : aucun prix FCFA n'est répété ici
 * en dur (les tarifs affichés sur "Abonnement" sont lus depuis la base et
 * peuvent changer) — seules les LIMITES/fonctionnalités par palier, qui elles
 * suivent le code, sont mentionnées.
 */
const FAQ_CATEGORIES: FaqCategory[] = [
  {
    title: "Ma boutique",
    items: [
      {
        question: "Comment personnaliser ma boutique (logo, bannière, couleur) ?",
        answer:
          "Depuis « Ma boutique », ajoute ton logo et ta photo de couverture (bannière) — disponibles sur tous les plans, y compris Starter (gratuit). La couleur d'accent personnalisée (remplace le vert KEVA par défaut sur ta boutique et tes fiches produit) reste réservée au plan Pro.",
      },
      {
        question: "Comment mes clients me contactent-ils ?",
        answer:
          "Renseigne ton numéro WhatsApp dans « Ma boutique » : un bouton « Contacter sur WhatsApp » apparaît alors automatiquement sur ta boutique et tes fiches produit. Laisse le champ vide pour ne pas l'afficher.",
      },
      {
        question: "Comment fonctionnent les frais de livraison ?",
        answer:
          "Renseigne un montant fixe dans « Ma boutique » : il est affiché au client avant qu'il confirme sa commande. Laisse le champ vide si ton tarif dépend de la zone — le client saura alors que c'est à confirmer directement avec toi.",
      },
      {
        question: "Comment recevoir un email à chaque nouvelle commande ?",
        answer:
          "Renseigne une adresse dans « Ma boutique », champ « Email pour les notifications de commande ». Elle peut être différente de ton email de connexion. Laisse le champ vide pour ne recevoir aucun email.",
      },
    ],
  },
  {
    title: "Produits",
    items: [
      {
        question: "Comment ajouter un produit ?",
        answer:
          "Depuis « Produits », clique sur « Ajouter un produit ». Tu peux aussi dupliquer un produit existant très proche (bouton « Dupliquer ») pour ne pas tout ressaisir : il ne restera plus qu'à changer les photos (jamais reprises automatiquement) et éventuellement le nom.",
      },
      {
        question: "Quelle est la limite de produits selon mon plan ?",
        answer:
          "Starter (gratuit) : 2 produits. Business : jusqu'à 30. Pro : illimité. Si tu passes à un plan avec une limite plus basse, tes produits les plus récents en excédent sont automatiquement désactivés — jamais supprimés — et redeviennent actifs dès que tu repasses à un plan suffisant.",
      },
      {
        question: "Pourquoi je ne peux pas gérer mon stock ou ajouter des variantes (taille, couleur) ?",
        answer:
          "La gestion du stock et les variantes (taille, couleur, matière...) sont disponibles à partir du plan Business. Sur Starter, un produit se vend sans suivi de stock ni déclinaison.",
      },
      {
        question: "Comment fonctionne le prix soldé ?",
        answer:
          "Dans la fiche produit, renseigne un « Prix soldé » avec, si tu veux, une date de début et de fin : il remplace le prix normal uniquement pendant cette période. C'est différent du « prix barré », qui reste affiché en permanence pour montrer une réduction habituelle.",
      },
      {
        question: "Quelles sont les règles pour les photos produit ?",
        answer:
          "Résolution entre 500×500 et 2000×2000 px, 2 Mo maximum par photo, fond blanc recommandé sans filigrane. Au moins 1 photo est obligatoire pour enregistrer un produit, jusqu'à 6 au total.",
      },
      {
        question: "Comment désactiver plusieurs produits d'un coup ?",
        answer:
          "Depuis « Produits », coche les produits concernés (ou « Tout sélectionner ») puis clique sur « Activer » ou « Désactiver » — utile en fin de collection ou en cas de rupture fournisseur.",
      },
    ],
  },
  {
    title: "Commandes & paiement",
    items: [
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
        question: "Comment exporter mes commandes ?",
        answer:
          "Depuis « Commandes », clique sur « Exporter en CSV » pour télécharger la liste complète, utilisable dans Excel ou Google Sheets.",
      },
      {
        question: "Comment relancer un client qui a abandonné son panier avant de payer ?",
        answer:
          "« Paniers abandonnés » (plan Business et plus) liste les clients qui ont rempli le formulaire de commande sans jamais cliquer sur « Confirmer », avec un bouton WhatsApp pré-rempli. C'est toi qui écris, quand tu veux si tu veux — aucun message n'est jamais envoyé automatiquement au nom de KEVA.",
      },
    ],
  },
  {
    title: "Avis clients",
    items: [
      {
        question: "Un client a laissé un avis, où le voir ?",
        answer:
          "Tous les avis reçus sur tes produits sont regroupés dans « Avis », y compris ceux sur un produit que tu as temporairement désactivé.",
      },
      {
        question: "Puis-je répondre à un avis client ?",
        answer:
          "Oui, depuis « Avis » : ta réponse s'affiche publiquement juste en dessous de l'avis, visible par tous les visiteurs de la fiche produit — utile pour remercier un client satisfait ou répondre calmement à une critique.",
      },
    ],
  },
  {
    title: "Faire grossir ma boutique",
    items: [
      {
        question: "Comment créer un code promo ?",
        answer:
          "Fonctionnalité du plan Pro. Depuis « Codes promo », crée un code avec une réduction en pourcentage ou en montant fixe, et si tu veux une limite d'utilisations et une date d'expiration. Le rabais est appliqué et vérifié automatiquement à la commande.",
      },
      {
        question: "Comment voir mes statistiques de vente ?",
        answer:
          "À partir du plan Business, « Statistiques » affiche ton chiffre d'affaires dans le temps, tes produits les plus vendus et les plus vus, et la répartition de tes commandes par statut. Le plan Pro ajoute en plus le taux de conversion et la comparaison entre deux périodes.",
      },
      {
        question: "Qu'est-ce que le badge « Boutique vérifiée » ?",
        answer:
          "Un badge de confiance affiché sur ta boutique publique, automatique à partir du plan Business — aucune démarche à faire de ton côté, il apparaît dès que ton abonnement est actif.",
      },
    ],
  },
  {
    title: "Équipe",
    items: [
      {
        question: "Puis-je ajouter quelqu'un pour m'aider à gérer ma boutique ?",
        answer:
          "Oui, à partir du plan Pro : « Collaborateurs » te permet d'inviter jusqu'à 2 personnes par email. Une fois l'invitation acceptée, elles peuvent gérer tes produits, tes commandes et l'aperçu de la boutique — jamais tes réglages boutique, tes paiements, ton abonnement, tes codes promo ou la liste des collaborateurs elle-même, qui restent réservés à toi seul.",
      },
    ],
  },
  {
    title: "Abonnement",
    items: [
      {
        question: "Pourquoi j'ai accès à toutes les fonctionnalités Pro dès la création de ma boutique ?",
        answer:
          "Chaque nouvelle boutique démarre avec un mois d'essai gratuit au plan Pro complet, pour te laisser tout tester sans limite dès le début. À la fin de ce mois, si tu n'as pas encore souscrit à un plan payant, ta boutique repasse automatiquement sur Starter (gratuit, 2 produits) — jamais suspendue.",
      },
      {
        question: "Que se passe-t-il si mon abonnement expire ?",
        answer:
          "Tu gardes un accès complet pendant une période de grâce de 7 jours après l'expiration (un email t'avertit dès son début). Passé ce délai, ta boutique repasse automatiquement au plan Starter — jamais suspendue — et tu reçois un email de confirmation. Tu ne peux alors plus ajouter de nouveaux produits au-delà de la limite Starter, mais ta boutique reste visible et tu peux toujours gérer tes produits et commandes existants. Renouvelle depuis « Abonnement ».",
      },
      {
        question: "Quelle est la différence entre les plans Starter, Business et Pro ?",
        answer:
          "Starter (gratuit) : 2 produits, sans gestion de stock ni variantes. Business : jusqu'à 30 produits, gestion du stock, variantes, logo personnalisé, statistiques, paniers abandonnés et badge « Boutique vérifiée ». Pro : produits illimités, codes promo, couleur d'accent personnalisée, statistiques complètes et jusqu'à 2 collaborateurs. Le détail complet et les tarifs à jour sont sur la page « Abonnement ».",
      },
    ],
  },
];

/** Insensible aux accents/à la casse — un vendeur qui tape "livraison" au clavier
    téléphone ne met pas toujours les accents correctement. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalize(query.trim());

  // Recherche demandée par Isaac le 23/09/2026 ("posez vos questions, filtré
  // par mots-clés") : filtre en direct, côté client, sur le texte réel de la
  // question ET de la réponse (pas une liste de mots-clés à maintenir à part
  // — avec ~25 questions déjà écrites avec soin, dupliquer leur contenu en
  // mots-clés séparés aurait vite divergé). Suffit largement à l'échelle
  // d'une FAQ, jamais besoin d'un vrai moteur de recherche ici.
  const filteredCategories = useMemo(() => {
    if (!normalizedQuery) return FAQ_CATEGORIES;
    return FAQ_CATEGORIES.map((category) => ({
      ...category,
      items: category.items.filter((item) =>
        normalize(`${item.question} ${item.answer}`).includes(normalizedQuery)
      ),
    })).filter((category) => category.items.length > 0);
  }, [normalizedQuery]);

  const resultCount = filteredCategories.reduce((sum, c) => sum + c.items.length, 0);

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

      <div className="mt-6 flex max-w-2xl items-center gap-2 rounded-md border border-ligne bg-brume px-3 py-2">
        <IconSearch className="h-4 w-4 shrink-0 text-encre/40" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pose ta question (ex : logo, stock, code promo...)"
          className="w-full min-w-0 bg-transparent text-sm text-encre placeholder:text-encre/40 focus:outline-none"
        />
      </div>

      <div className="mt-6 max-w-2xl">
        {normalizedQuery && (
          <p className="mb-3 text-xs text-encre/50">
            {resultCount > 0
              ? `${resultCount} résultat${resultCount > 1 ? "s" : ""} pour « ${query.trim()} »`
              : `Aucun résultat pour « ${query.trim()} ».`}
          </p>
        )}

        {resultCount === 0 && normalizedQuery && (
          <p className="text-sm text-encre/70">
            Essaie avec d&apos;autres mots (ex : « livraison », « avis »,
            « abonnement »...), ou explore les catégories ci-dessous.
          </p>
        )}

        {filteredCategories.map((category) => (
          <div key={category.title} className="mb-6">
            <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-encre/50">
              {category.title}
            </h2>
            <div className="divide-y divide-ligne">
              {category.items.map((item, index) => (
                <details key={index} className="group py-3">
                  <summary className="cursor-pointer text-sm font-medium text-encre hover:text-vert-sapin">
                    {item.question}
                  </summary>
                  <p className="mt-2 text-sm text-encre/70">{item.answer}</p>
                  {item.videoUrl && (
                    <a
                      href={item.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-sm text-vert-actif underline"
                    >
                      Voir le tuto en vidéo
                    </a>
                  )}
                </details>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function IconSearch(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}
