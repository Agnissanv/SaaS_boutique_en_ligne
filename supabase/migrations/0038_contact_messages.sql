-- ============================================================================
-- Table pour le formulaire "Nous contacter" (22/09/2026, reprise du chantier
-- super-admin après la pause PawaPay) — trou le plus grave repéré dans
-- l'audit back-office : la page /contact (ajoutée le 22/09/2026, remplace
-- l'ancien mailto:) envoie un email via Brevo mais n'écrit RIEN en base. Si
-- cet email se perd (spam, panne Brevo, boîte pleine), le message du client
-- est perdu sans qu'Isaac le sache jamais — contrairement à un mailto direct
-- où le message atterrit au moins dans une boîte mail réelle.
--
-- Écriture réservée au service role (comme `payments`, voir 0001_init.sql) :
-- `src/app/contact/actions.ts` est une Server Action, jamais exposée au
-- navigateur — aucune policy d'insertion n'est donc nécessaire, exactement le
-- même raisonnement que pour `payments`. Seul un admin peut lire/mettre à
-- jour (marquer comme traité), même style que les policies `*_admin_read`/
-- `*_admin_update` de 0007_admin_backoffice.sql.
-- ============================================================================

create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  status text not null default 'new' check (status in ('new', 'handled')),
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references profiles (id) on delete set null
);

create index if not exists contact_messages_status_created_at_idx
  on contact_messages (status, created_at desc);

alter table contact_messages enable row level security;

create policy "contact_messages_admin_read" on contact_messages
  for select using (is_admin());

create policy "contact_messages_admin_update" on contact_messages
  for update using (is_admin()) with check (is_admin());

-- Pas de policy d'insertion : seul le service role (Server Action) écrit ici,
-- exactement comme `payments`. Pas de policy de suppression non plus — un
-- message reçu reste dans l'historique, au pire marqué "handled".
