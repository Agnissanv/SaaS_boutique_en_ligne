/**
 * Espace de notification unifié (21/09/2026) — table `notifications`
 * (0001_init.sql) enfin utilisée, colonnes `link`/`kind` ajoutées en
 * migration 0030. Un seul endroit pour les libellés/couleurs par type
 * d'événement, réutilisé par `/dashboard/notifications` (vendeur) et
 * `/compte/notifications` (client) — même principe que `ORDER_STATUS_*`
 * dans `src/lib/orders.ts`.
 *
 * Isaac : "je veux un vrai espace notification qui concerne tout" — nouvelle
 * commande, annulation, changement de statut, avis possible après livraison.
 * Les messages admin → vendeur ("admin_message") ne sont pas encore émis
 * nulle part dans le code (aucune UI pour qu'un admin en envoie un pour
 * l'instant — prochaine étape si Isaac le souhaite), mais le type existe déjà
 * en base et ici pour ne pas avoir à retoucher ces deux pages le jour où
 * cette UI sera ajoutée.
 */
export type NotificationKind =
  | "new_order"
  | "order_cancelled"
  | "status_change"
  | "review_ready"
  | "admin_message"
  | "info";

export const NOTIFICATION_KIND_BADGE_CLASS: Record<NotificationKind, string> = {
  new_order: "bg-vert-actif/15 text-vert-sapin",
  order_cancelled: "bg-erreur/15 text-erreur",
  status_change: "bg-vert-actif/15 text-vert-sapin",
  review_ready: "bg-cuivre/15 text-cuivre-profond",
  admin_message: "bg-attention/15 text-attention",
  info: "bg-sable text-encre/60",
};

export const NOTIFICATION_KIND_LABEL: Record<NotificationKind, string> = {
  new_order: "Nouvelle commande",
  order_cancelled: "Annulation",
  status_change: "Commande",
  review_ready: "Avis",
  admin_message: "KEVA",
  info: "Info",
};
