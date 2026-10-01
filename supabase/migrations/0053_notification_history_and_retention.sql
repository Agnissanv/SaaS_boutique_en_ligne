-- ============================================================================
-- 01/10/2026 — Historique d'envoi admin + rétention des messages/notifications
--
-- Deux demandes d'Isaac dans le même échange, suite à l'ajout de
-- /admin/notifications (migration 0052) :
--
-- 1) "Historique des deux côtés" : le côté RÉCEPTION (boutique/client) a déjà
--    son historique depuis le 21/09/2026 (`notifications`,
--    /dashboard/notifications, /compte/notifications). Il manquait le côté
--    ENVOI côté admin — "qu'est-ce que j'ai envoyé, à qui, quand". `insert
--    into notifications` écrit UNE LIGNE PAR BOUTIQUE destinataire (voir
--    0052) : pas réutilisable tel quel pour une vue "campagnes envoyées" sans
--    requête de regroupement fragile. `admin_notification_campaigns`
--    ci-dessous : une ligne par ENVOI (groupe), lue par /admin/notifications.
--
-- 2) Rétention limitée ("3 mois, 2 mois, peu importe, pour ne pas saturer la
--    base") : purge automatique au-delà de MESSAGE_RETENTION_DAYS (voir
--    src/lib/message-retention.ts, 90 jours par défaut) sur `notifications`,
--    `contact_messages` ET `admin_notification_campaigns`. Gérée par le
--    nouveau cron /api/cron/purge-old-messages (voir vercel.json) plutôt
--    qu'ici en SQL (ex: pg_cron) : la durée doit rester modifiable depuis le
--    code sans nouvelle migration, et le projet a déjà un cron Vercel pour ce
--    genre de tâche planifiée (subscription-lifecycle, migration 0029).
-- ============================================================================

create table if not exists admin_notification_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  link text,
  -- "all" ou l'id d'une boutique précise (même valeur que `target` envoyée
  -- par le formulaire) — `target_label` fige à côté le libellé humain lu au
  -- moment de l'envoi ("Toutes les boutiques actives (9)" ou le nom de la
  -- boutique) : un nom de boutique peut changer après coup, l'historique doit
  -- rester lisible tel qu'il était au moment de l'envoi, pas recalculé après.
  target text not null,
  target_label text not null,
  recipient_count integer not null,
  sent_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists admin_notification_campaigns_created_at_idx
  on admin_notification_campaigns (created_at desc);

alter table admin_notification_campaigns enable row level security;

-- Lecture réservée aux admins, même fonction `is_admin()` que les autres
-- tables du back-office (0007_admin_backoffice.sql). Aucune policy
-- insert/update/delete créée volontairement : l'écriture passe exclusivement
-- par `createServiceRoleClient()` dans `sendAdminNotification` (même raison
-- que `notifications`, voir 0052) — RLS bloque donc tout accès non
-- service-role pour ces opérations, même pour un admin connecté.
create policy "admin_notification_campaigns_admin_read" on admin_notification_campaigns
  for select
  using (is_admin());
