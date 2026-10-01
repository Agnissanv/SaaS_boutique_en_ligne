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
 *
 * Messages admin → vendeur ("admin_message") : composés et envoyés depuis
 * `/admin/notifications` (01/10/2026) — rappels, infos de parrainage,
 * annonces de fonctionnalité, piqûre de rappel sur une fonctionnalité sous-
 * utilisée, etc. Un simple insert dans `notifications` (une ligne par
 * boutique ciblée) suffit aussi à déclencher la notification push (trigger
 * pg_net, migration 0052) — une boutique la reçoit donc même si elle n'est
 * pas sur KEVA au moment de l'envoi.
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
