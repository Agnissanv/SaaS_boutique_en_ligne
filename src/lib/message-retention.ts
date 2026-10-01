/**
 * Durée de rétention des messages/notifications — ajoutée le 01/10/2026,
 * demande d'Isaac : "si un message ou une conversation fait environ trois
 * mois... elle disparaît, pour ne pas saturer la base de données". 90 jours
 * choisi comme valeur par défaut (milieu de la fourchette "deux, trois mois"
 * donnée par Isaac) — modifiable ici sans toucher au cron qui l'applique
 * (`/api/cron/purge-old-messages`, voir ce fichier pour la liste des tables
 * concernées : `notifications`, `contact_messages`,
 * `admin_notification_campaigns`).
 *
 * Un seul réglage pour les trois tables plutôt qu'une durée par table : plus
 * simple à expliquer et à ajuster, et Isaac n'a pas demandé de distinction
 * entre elles ("tout ce qui est comme message ou notification").
 */
export const MESSAGE_RETENTION_DAYS = 90;
