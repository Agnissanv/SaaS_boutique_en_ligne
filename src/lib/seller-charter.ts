/**
 * Contenu de la charte vendeur — source unique pour `/charte-vendeur`
 * (page d'acceptation obligatoire) et pour le rappel de "Aide" une fois le
 * compte créé. Créée le 22/09/2026 à la demande d'Isaac.
 *
 * `CURRENT_SELLER_CHARTER_VERSION` : incrémenter cette valeur force TOUS les
 * comptes (même ceux qui avaient déjà accepté une version antérieure) à
 * revalider la charte à leur prochaine visite du dashboard — voir
 * `supabase/migrations/0040_seller_charter_acceptance.sql` et le contrôle
 * dans `dashboard/layout.tsx`. À faire le jour où le contenu ci-dessous
 * change réellement (une reformulation cosmétique ne le justifie pas).
 */
export const CURRENT_SELLER_CHARTER_VERSION = 1;

export const SELLER_CHARTER_SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "Ce que tu dois faire",
    items: [
      "Décrire tes produits de façon exacte : prix, disponibilité et photos réelles.",
      "Tenir le statut de tes commandes à jour (Payée, En préparation, Livrée, Annulée) pour que tes clients puissent suivre leur commande.",
      "Rester joignable par tes clients, notamment via le numéro WhatsApp renseigné sur ta boutique.",
      "Respecter les prix affichés au moment de la commande.",
    ],
  },
  {
    title: "Ce qui est interdit à la vente",
    items: [
      "Armes, munitions, explosifs et matières dangereuses.",
      "Stupéfiants, drogues et leurs précurseurs.",
      "Médicaments et produits pharmaceutiques, sauf autorisation officielle (pharmacie ou dépôt agréé).",
      "Espèces animales ou végétales protégées et leurs dérivés (ivoire, peaux, écailles...).",
      "Produits contrefaits ou copies non autorisées d'une marque ou d'une œuvre.",
      "Biens volés, faux documents, fausse monnaie ou données personnelles/bancaires d'autrui.",
      "Contenus à caractère pornographique, ou destinés à exploiter des mineurs.",
      "Plus largement, tout produit dont la vente est interdite par la loi ivoirienne.",
    ],
  },
  {
    title: "En cas de non-respect",
    items: [
      "Un produit concerné est retiré et ta boutique peut être suspendue, sans préavis pour les cas les plus graves.",
      "La liste complète et les autres règles de la plateforme sont détaillées dans les conditions d'utilisation.",
    ],
  },
];
