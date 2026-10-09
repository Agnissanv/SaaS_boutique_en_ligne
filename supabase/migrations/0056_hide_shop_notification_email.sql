-- ============================================================================
-- `shops.notification_email` n'est plus lisible publiquement
-- — 09/10/2026 (audit de sécurité, point 4).
--
-- Problème : la politique `shops_public_read_active` (0001) ouvre la lecture
-- de la LIGNE ENTIÈRE des boutiques actives. RLS filtre des lignes, jamais des
-- colonnes : l'email privé de notification du vendeur était donc lisible par
-- n'importe qui avec la clé publique
-- (`/rest/v1/shops?select=notification_email`) — collecte d'emails, spam,
-- hameçonnage ciblé.
--
-- Correctif : droits par colonne. On retire le droit SELECT sur la table
-- entière aux rôles `anon` et `authenticated`, puis on le redonne colonne par
-- colonne pour TOUTES les colonnes sauf `notification_email`. La liste est
-- lue dans le catalogue au moment de la migration (pas codée en dur) pour ne
-- rien oublier, y compris des colonnes absentes de src/lib/types/database.ts.
--
-- Qui lit encore `notification_email` :
--   - le service role (webhook Nyole, cron des abonnements) : non concerné ;
--   - les fonctions `security definer` (get_order_notification_info,
--     get_low_stock_alert_info) : non concernées ;
--   - le vendeur sur Paramètres > Notifications : via la nouvelle fonction
--     `get_my_shop_notification_email()` ci-dessous.
-- L'écriture (`update ... set notification_email`) n'est pas touchée : le
-- droit UPDATE est distinct du droit SELECT.
--
-- ⚠️ À RETENIR POUR LES PROCHAINES MIGRATIONS : une colonne ajoutée à `shops`
-- ne sera PAS lisible par `anon`/`authenticated` tant qu'elle n'est pas
-- accordée explicitement :
--     grant select (nouvelle_colonne) on public.shops to anon, authenticated;
-- Et aucune requête ne doit faire `select *` sur `shops` côté client
-- (vérifié le 09/10/2026 : aucune).
-- ============================================================================

do $$
declare
  v_columns text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into v_columns
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shops'
      and column_name <> 'notification_email';

  execute 'revoke select on public.shops from anon, authenticated';
  execute format('grant select (%s) on public.shops to anon, authenticated', v_columns);
end;
$$;

-- Lecture de son propre email de notification (propriétaire uniquement, même
-- règle que la page Paramètres > Notifications, réservée au propriétaire).
create or replace function public.get_my_shop_notification_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select notification_email
  from shops
  where owner_id = auth.uid()
  limit 1;
$$;

revoke execute on function public.get_my_shop_notification_email() from public, anon;
grant execute on function public.get_my_shop_notification_email() to authenticated;
