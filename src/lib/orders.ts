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

/**
 * Classes en aplat (pas en badge translucide) pour les barres de répartition
 * de `/dashboard/statistiques` (16/09/2026, plan Business+) — mêmes tokens
 * sémantiques que `ORDER_STATUS_BADGE_CLASS` ci-dessus, réutilisés plutôt que
 * d'inventer une nouvelle palette pour ce graphique.
 */
export const ORDER_STATUS_BAR_CLASS: Record<string, string> = {
  pending: "bg-attention",
  paid: "bg-vert-actif",
  preparing: "bg-vert-actif",
  delivered: "bg-succes",
  cancelled: "bg-erreur",
};

/**
 * Message client par changement de statut — extrait le 21/09/2026 (espace de
 * notification unifié) depuis `src/lib/email/order-notifications.ts`, qui en
 * avait jusqu'ici sa propre copie locale (`STATUS_MESSAGES`). Un seul endroit
 * désormais, réutilisé à la fois par l'email de notification ET par la
 * nouvelle notification en base (`dashboard/commandes/actions.ts`) — même
 * raison que le reste de ce fichier : pas de logique de statut dupliquée.
 *
 * Pas d'entrée pour "pending" (état initial, rien à notifier) ni "delivered"
 * — la livraison déclenche une notification différente, orientée avis
 * client ("review_ready"), pas ce message générique de changement de statut.
 */
export const ORDER_STATUS_CUSTOMER_MESSAGE: Partial<Record<string, { title: string; body: string }>> = {
  paid: {
    title: "Ta commande a été confirmée",
    body: "Bonne nouvelle : ta commande a été confirmée par le vendeur.",
  },
  preparing: {
    title: "Ta commande est en préparation",
    body: "Le vendeur a commencé à préparer ta commande.",
  },
  cancelled: {
    title: "Ta commande a été annulée",
    body: "Ta commande a été annulée par le vendeur. Contacte-le directement si tu as des questions.",
  },
};
