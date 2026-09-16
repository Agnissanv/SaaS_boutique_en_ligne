-- ============================================================================
-- Restriction de la notification email "nouvelle commande" au plan
-- (16/09/2026) — décision produit d'Isaac.
--
-- `sendNewOrderVendorEmail` (src/lib/email/new-order-notification.ts) partait
-- jusqu'ici pour TOUTE boutique ayant un `notification_email`, sans jamais
-- vérifier le flag `has_order_notifications` de son plan — repéré en
-- vérifiant quelles fonctionnalités affichées sur /dashboard/abonnement
-- étaient réellement câblées. Isaac a tranché : ça devient un vrai avantage
-- Business/Pro, Starter le perd.
--
-- `get_order_notification_info` (0013_vendor_profile_and_notifications.sql)
-- est appelée SANS session vendeur authentifiée (juste après la création de
-- la commande côté client, voir notify-vendor-action.ts) : elle ne peut donc
-- pas s'appuyer sur `auth.uid()` pour vérifier le plan. On calcule le flag
-- DANS la fonction `security definer` elle-même plutôt que de faire porter
-- cette vérification côté client — même modèle que pour `notification_email`.
--
-- `RETURNS TABLE` change de colonnes : `create or replace` ne suffit pas en
-- Postgres pour ça, d'où le drop explicite avant recréation.
-- ============================================================================

drop function if exists public.get_order_notification_info(uuid);

create function public.get_order_notification_info(p_order_id uuid)
returns table (
  shop_name text,
  notification_email text,
  customer_name text,
  total_amount numeric,
  order_url_path text,
  has_order_notifications boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.name,
    s.notification_email,
    o.customer_name,
    o.total_amount,
    '/dashboard/commandes/' || o.id::text,
    coalesce(
      (
        select (sp.features->>'has_order_notifications')::boolean
        from subscriptions sub
        join subscription_plans sp on sp.id = sub.plan_id
        where sub.shop_id = s.id
        order by sub.started_at desc
        limit 1
      ),
      false
    )
  from orders o
  join shops s on s.id = o.shop_id
  where o.id = p_order_id;
$$;

grant execute on function public.get_order_notification_info(uuid) to anon, authenticated;
