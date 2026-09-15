/**
 * Statuts de commande partagés — extrait le 15/09/2026 (refonte visuelle du
 * dashboard vendeur, "on finit avec le dashboard vendeur") pour ne plus
 * dupliquer `STATUS_LABELS` entre l'aperçu, la liste des commandes et la
 * page paiements, et pour enfin appliquer les tokens sémantiques
 * (succes/attention/erreur) aux badges de statut — point resté "non fait"
 * depuis l'introduction de ces tokens (cf. decisions-techniques.md).
 *
 * Choix de couleur : pending (nouvelle commande, attend une action du
 * vendeur) et preparing (en cours) partagent le ton "attention" ; paid
 * (confirmée) et preparing utilisent le vert de marque pour "en cours,
 * ça avance" ; delivered = succes (issue positive finale) ; cancelled =
 * erreur (issue négative finale). Pas de nouvelle couleur inventée : on
 * réutilise les trois tokens sémantiques existants + le vert de marque.
 */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  paid: "Payée",
  preparing: "En préparation",
  delivered: "Livrée",
  cancelled: "Annulée",
};

// Classes Tailwind complètes en dur (jamais construites par template
// literal type `bg-${x}`) : Tailwind ne génère le CSS que pour les noms de
// classe qu'il peut voir littéralement dans le code source (même règle que
// STOCK_HEALTH_BAR_CLASS dans lib/products.ts).
export const ORDER_STATUS_BADGE_CLASS: Record<string, string> = {
  pending: "bg-attention/15 text-attention",
  paid: "bg-vert-actif/15 text-vert-sapin",
  preparing: "bg-vert-actif/15 text-vert-sapin",
  delivered: "bg-succes/15 text-succes",
  cancelled: "bg-erreur/15 text-erreur",
};
