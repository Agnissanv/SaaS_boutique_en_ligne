/**
 * Articles du blog KEVA — créé le 29/09/2026 à la demande d'Isaac ("un blog,
 * ça peut améliorer le SEO"), en remplacement du bloc "Newsletter" de la
 * page de référence qu'il a partagée : KEVA reste volontairement sans
 * collecte d'email (voir la migration `0044_abandoned_carts.sql`, décision
 * déjà actée — "pas dans notre quota de Brevo", tout le suivi client reste
 * manuel via WhatsApp), donc un blog sert le même objectif SEO sans
 * contredire ce choix.
 *
 * Contenu écrit ici pour de vrai (pas un texte de remplissage) : deux
 * premiers articles, ciblés sur les vraies recherches de la cible de KEVA
 * (vendeuse WhatsApp, jeune revendeur en Côte d'Ivoire) plutôt que du
 * contenu générique "e-commerce". Aucune statistique inventée, aucun
 * témoignage fabriqué — même discipline que le reste du site (voir
 * `TRUST_ITEMS`/compteurs réels dans `page.tsx`). Stocké en dur (pas de
 * table Supabase dédiée) tant qu'il n'y a que quelques articles : à revoir
 * si Isaac veut publier au rythme du calendrier de contenu
 * (`claude/calendrier-posts-2-semaines.md`).
 *
 * Deux articles comparatifs ajoutés le 02/10/2026 (chantier GEO — voir
 * decisions-techniques.md) : un tableau de comparaison est le format que les
 * moteurs IA génératifs (ChatGPT, Perplexity...) citent le plus facilement
 * pour répondre à "X vs Y", d'où le champ optionnel `table` ci-dessous.
 * Mêmes règles que les deux premiers articles : aucun chiffre inventé
 * (commission Jumia, prix KEVA...), aucun témoignage fabriqué, et respect de
 * la règle n°1 du calendrier de contenu — ne jamais présenter le paiement
 * Mobile Money comme disponible pour les commandes (seul le paiement à la
 * livraison l'est ; voir "Marche arrière..." dans decisions-techniques.md).
 */

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  /** Date ISO (YYYY-MM-DD) — utilisée pour le tri et le balisage SEO. */
  publishedAt: string;
  readingMinutes: number;
  sections: {
    heading?: string;
    paragraphs: string[];
    /** Tableau de comparaison optionnel, affiché après les paragraphes de la section. */
    table?: { headers: string[]; rows: string[][] };
  }[];
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "vendre-sur-whatsapp-5-astuces",
    title: "Vendre sur WhatsApp : 5 astuces pour transformer tes messages en commandes",
    excerpt:
      "« C'est combien ? », « il reste en M ? », « tu livres où ? »… Voici comment garder WhatsApp pour la relation client, sans y perdre tes journées.",
    publishedAt: "2026-09-29",
    readingMinutes: 4,
    sections: [
      {
        paragraphs: [
          "Si tu vends sur WhatsApp ou Instagram, tu connais déjà la scène : tu postes une photo, et les messages arrivent en rafale. Le prix, la taille, la disponibilité, l'adresse de livraison — les mêmes questions, du matin au soir. WhatsApp reste l'endroit où tes clientes te parlent, mais il n'est pas fait pour porter un catalogue entier. Voici cinq façons concrètes d'alléger cette charge, sans rien changer à la manière dont tu vends aujourd'hui.",
        ],
      },
      {
        heading: "1. Mets le prix sur la photo, toujours",
        paragraphs: [
          "Beaucoup de clientes n'osent pas demander le prix par message : elles scrollent, hésitent, et passent à autre chose sans rien dire. Un prix visible directement sur la photo évite cette friction silencieuse — celle qui ne se voit pas dans tes statistiques, mais qui coûte des ventes chaque jour.",
        ],
      },
      {
        heading: "2. Regroupe ton catalogue dans un seul lien",
        paragraphs: [
          "Envoyer 20 photos une par une à chaque nouvelle cliente prend du temps, et une partie du catalogue reste toujours invisible pour elle. Un lien unique, avec toutes tes photos, tailles et prix rangés au même endroit, permet à ta cliente de se servir elle-même — et à toi de ne garder que les vraies commandes à traiter.",
        ],
      },
      {
        heading: "3. Note tout, tout de suite",
        paragraphs: [
          "Nom, quartier, taille, produit : quand une commande arrive en plein rush, il est facile d'en perdre le fil. Un endroit unique où chaque commande est enregistrée automatiquement — plutôt que dans ta mémoire ou un carnet — évite les \"c'était qui déjà, la cliente de la robe rouge ?\" du soir.",
        ],
      },
      {
        heading: "4. Garde WhatsApp pour la confiance, pas pour le catalogue",
        paragraphs: [
          "Tes clientes t'écrivent sur WhatsApp parce qu'elles te font confiance — ce lien-là ne doit pas disparaître. L'idée n'est pas de remplacer WhatsApp, mais de lui retirer une charge qu'il n'a jamais été fait pour porter : répéter les mêmes informations des dizaines de fois par jour. Le message final (\"votre commande est prête\", \"c'est en route\") garde tout son sens quand il arrive au bon moment, pas noyé dans 40 autres.",
        ],
      },
      {
        heading: "5. Accepte le paiement à la livraison sans complexe",
        paragraphs: [
          "En Côte d'Ivoire, beaucoup de premières clientes préfèrent payer à la réception plutôt que d'avancer de l'argent à un vendeur qu'elles ne connaissent pas encore. Ce n'est pas un problème à résoudre : c'est une habitude à respecter. Une fois la confiance installée après une première commande réussie, les paiements en amont deviennent naturellement plus faciles à proposer.",
        ],
      },
    ],
  },
  {
    slug: "paiement-a-la-livraison-confiance-client",
    title: "Pourquoi le paiement à la livraison rassure tes premières clientes",
    excerpt:
      "Demander de payer avant d'avoir reçu le produit reste le principal frein d'une cliente qui commande chez toi pour la première fois. Voici pourquoi, et comment en tenir compte sans perdre la vente.",
    publishedAt: "2026-09-29",
    readingMinutes: 3,
    sections: [
      {
        paragraphs: [
          "Une cliente qui découvre ta boutique pour la première fois ne te connaît pas encore. Elle n'a vu ni tes produits en vrai, ni la qualité de ton service après-vente. Lui demander de payer intégralement avant la livraison revient à lui demander de te faire confiance sur parole — ce qui, pour une première commande, reste souvent le principal frein à l'achat en ligne en Côte d'Ivoire.",
        ],
      },
      {
        heading: "Le paiement à la livraison lève ce frein",
        paragraphs: [
          "En laissant la cliente payer au moment où elle reçoit réellement le produit, tu retires le risque de son côté : si l'article ne correspond pas, elle peut encore refuser avant de payer. Ce n'est pas un détail technique — c'est souvent la différence entre une commande qui se confirme et une conversation qui s'arrête au \"je réfléchis\".",
        ],
      },
      {
        heading: "Ce que ça change pour toi, vendeur",
        paragraphs: [
          "Le compromis est réel : tu prends en charge une partie du risque logistique (un colis refusé à la livraison reste possible). C'est pour cette raison que noter clairement l'adresse, le quartier et le numéro de la cliente au moment de la commande fait toute la différence — moins d'ambiguïté au moment de la livraison, moins de allers-retours inutiles.",
        ],
      },
      {
        heading: "Et après la première commande ?",
        paragraphs: [
          "Une fois qu'une cliente a reçu une première commande dans de bonnes conditions, la confiance est installée : les commandes suivantes se font souvent plus vite, avec moins d'hésitation. Le paiement à la livraison n'est donc pas une contrainte permanente — c'est la porte d'entrée qui permet à une nouvelle cliente de te faire confiance une première fois.",
        ],
      },
    ],
  },
  {
    slug: "keva-ou-vendre-seulement-sur-whatsapp",
    title: "KEVA ou vendre uniquement sur WhatsApp/Instagram : faut-il choisir ?",
    excerpt:
      "WhatsApp et Instagram sont faits pour discuter, pas pour vendre. Voici leurs vraies limites, et ce qu'une boutique KEVA change concrètement.",
    publishedAt: "2026-10-02",
    readingMinutes: 5,
    sections: [
      {
        paragraphs: [
          "WhatsApp et Instagram sont des outils de messagerie, pas des outils de vente — ça fonctionne pour démarrer, mais les limites apparaissent vite dès que les commandes s'enchaînent. Un catalogue qui disparaît en 24h, les mêmes questions de prix et de taille répétées des dizaines de fois par jour, aucune vue d'ensemble sur ce qui a été commandé. Voici ce qu'une vraie boutique KEVA change.",
        ],
      },
      {
        heading: "Les limites de WhatsApp et Instagram pour vendre",
        paragraphs: [
          "Un statut WhatsApp s'efface en 24h, et une publication Instagram se noie vite dans le fil — ton catalogue n'est donc jamais réellement visible en entier, à aucun moment. Chaque cliente doit t'écrire pour connaître un prix, une taille, une disponibilité, et toi, tu dois répondre à la main, à chaque fois. Résultat : des ventes perdues en silence (une cliente qui n'ose pas demander le prix et qui passe à autre chose) et des commandes suivies de mémoire ou dans un carnet, avec le risque d'en perdre le fil.",
        ],
      },
      {
        heading: "Ce que KEVA apporte à la place",
        paragraphs: [],
        table: {
          headers: ["", "Limite de WhatsApp/Instagram seul", "Avantage KEVA"],
          rows: [
            [
              "Ton catalogue",
              "Statuts qui disparaissent en 24h, photos éparpillées dans la conversation",
              "Un lien permanent, avec prix, tailles et stock toujours à jour",
            ],
            [
              "Comment une cliente commande",
              "Elle doit t'écrire et attendre ta réponse pour chaque détail",
              "Elle choisit et commande directement, à toute heure, sans t'écrire d'abord",
            ],
            [
              "Suivi des commandes",
              "Noté de mémoire ou dans un carnet, facile à perdre",
              "Liste organisée par statut dans un tableau de bord",
            ],
            [
              "Paiement",
              "À négocier au cas par cas",
              "Paiement à la livraison, pareil pour toutes les commandes",
            ],
            [
              "Image pour une nouvelle cliente",
              "Un compte personnel parmi d'autres, sans repère professionnel",
              "Une vraie boutique à ton nom, avec son propre lien",
            ],
          ],
        },
      },
      {
        heading: "Ta boutique t'appartient, pas un algorithme",
        paragraphs: [
          "Sur Instagram, un algorithme décide qui voit tes publications aujourd'hui. Sur WhatsApp, un statut s'efface tout seul après 24h. Une boutique KEVA, elle, reste en ligne en permanence, avec ton catalogue complet, à l'adresse que tu choisis — tu ne dépends d'aucune des deux pour que tes clientes puissent voir ce que tu vends.",
        ],
      },
      {
        heading: "WhatsApp redevient un outil de confiance, pas ta seule vitrine",
        paragraphs: [
          "Rien n'oblige à abandonner WhatsApp : chaque commande reçue sur ta boutique garde un bouton pour écrire directement à la cliente, exactement comme aujourd'hui. La différence, c'est que WhatsApp n'a plus à porter tout le poids de la vente — ta boutique KEVA s'occupe du catalogue et du suivi, WhatsApp reste pour la relation et la confiance.",
        ],
      },
    ],
  },
  {
    slug: "keva-ou-jumia-petit-vendeur",
    title: "KEVA ou Jumia : quelle plateforme pour un petit vendeur indépendant ?",
    excerpt:
      "Jumia a l'audience, mais cette audience a un prix : une commission sur chaque vente et une image qui n'est pas la tienne. Voici ce que KEVA fait différemment.",
    publishedAt: "2026-10-02",
    readingMinutes: 5,
    sections: [
      {
        paragraphs: [
          "Jumia est connue de la quasi-totalité des acheteurs en ligne en Côte d'Ivoire, mais cette notoriété a un prix pour le vendeur : une commission prélevée sur chaque vente, et une fiche produit qui porte l'image de Jumia, pas la tienne. Voici ce que ça change concrètement pour un petit vendeur indépendant, et ce que KEVA fait différemment.",
        ],
      },
      {
        heading: "Le vrai coût de vendre sur Jumia",
        paragraphs: [
          "Une commission prélevée sur chaque vente réduit directement ta marge, avant même de compter tes propres frais. Les conditions sont fixées par la plateforme : tu ne contrôles ni la présentation de ton produit, ni les règles du jeu. Et ta fiche produit se noie au même format que des milliers d'autres vendeurs — à l'œil du client, ce n'est pas ta marque qu'il voit, c'est Jumia.",
        ],
      },
      {
        heading: "Ce que Jumia apporte malgré tout",
        paragraphs: [
          "Il faut lui reconnaître une chose : une audience déjà là, qui cherche déjà à acheter. Mais cette audience, tu la payes à chaque vente, et elle ne devient jamais vraiment TA clientèle — elle reste celle de Jumia.",
        ],
      },
      {
        heading: "Ce que KEVA te donne à la place",
        paragraphs: [],
        table: {
          headers: ["", "Jumia", "Avantage KEVA"],
          rows: [
            [
              "Commission sur chaque vente",
              "Prélevée automatiquement, sur chaque commande",
              "Aucune — un abonnement par boutique, avec un plan gratuit pour démarrer",
            ],
            [
              "Image de marque",
              "Fiche produit au format Jumia, parmi des milliers d'autres vendeurs",
              "Ta boutique, à ton nom, avec ton propre lien",
            ],
            [
              "Contact avec le client",
              "Passe par la plateforme, jamais en direct",
              "Bouton WhatsApp direct depuis chaque commande",
            ],
            [
              "Qui décide des règles",
              "La plateforme — prix, présentation, conditions",
              "Toi — c'est ta boutique",
            ],
            [
              "Ta clientèle t'appartient-elle ?",
              "Non, elle reste celle de Jumia",
              "Oui, la relation reste directement entre toi et ta cliente",
            ],
          ],
        },
      },
      {
        heading: "Le vrai calcul pour un vendeur indépendant",
        paragraphs: [
          "Jumia peut convenir pour écouler du volume sans se soucier de sa marque — c'est son métier, pas un défaut en soi. Mais si tu veux construire une vraie boutique à ton nom, garder ta marge entière et parler directement à tes clientes, c'est exactement ce pour quoi KEVA est fait : aucune commission sur tes ventes, ta propre image, et un lien qui t'appartient à toi, pas à une plateforme tierce.",
        ],
      },
    ],
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}
