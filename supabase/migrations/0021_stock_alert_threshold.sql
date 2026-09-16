-- ============================================================================
-- Alertes de stock avancées (`has_advanced_stock_alerts`, plan Pro) —
-- 16/09/2026. Deux volets demandés par Isaac, au-delà de la barre de santé
-- déjà gratuite pour tous (seuil fixe LOW_STOCK_THRESHOLD = 5, src/lib/products.ts) :
-- 1. Un seuil d'alerte personnalisable PAR PRODUIT plutôt que le seuil fixe
--    universel (colonne ci-dessous, `null` = retombe sur le seuil par défaut).
-- 2. Un email proactif au vendeur dès qu'un produit franchit son seuil vers
--    le bas, sans attendre qu'il consulte le dashboard (RPC ci-dessous).
-- ============================================================================

alter table products
  add column if not exists stock_alert_threshold integer check (
    stock_alert_threshold is null or stock_alert_threshold >= 0
  );

-- `get_low_stock_alert_info` : appelée juste après `create_order` (comme
-- `get_order_notification_info`, migration 0013/0020), donc SANS session
-- vendeur authentifiée — même modèle de "jeton de capacité" par UUID de
-- commande. Plutôt que de modifier `create_order` (dont le type de retour
-- `uuid` est utilisé par tous ses appelants — trop risqué pour ce chantier),
-- on déduit le "stock avant" à partir de `order_items.quantity` de CETTE
-- commande précise : stock_avant = stock actuel + quantité commandée. Ne
-- renvoie une ligne QUE pour un produit qui vient de FRANCHIR son seuil vers
-- le bas (stock_avant strictement au-dessus du seuil, stock actuel à ou
-- en-dessous) — pas à chaque commande une fois déjà sous le seuil, pour ne
-- pas spammer le vendeur à chaque nouvelle vente d'un produit déjà signalé.
-- Ne renvoie rien du tout si le plan de la boutique n'a pas
-- `has_advanced_stock_alerts` — calculé ici, pas côté client, même
-- raisonnement que pour `has_order_notifications` (migration 0020).
create or replace function public.get_low_stock_alert_info(p_order_id uuid)
returns table (
  shop_name text,
  notification_email text,
  product_title text,
  stock_after integer,
  threshold integer
)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.name,
    s.notification_email,
    p.title,
    p.stock,
    coalesce(p.stock_alert_threshold, 5)
  from orders o
  join shops s on s.id = o.shop_id
  join order_items oi on oi.order_id = o.id
  join products p on p.id = oi.product_id
  where o.id = p_order_id
    and p.stock <= coalesce(p.stock_alert_threshold, 5)
    and (p.stock + oi.quantity) > coalesce(p.stock_alert_threshold, 5)
    -- Le plan ACTUEL de la boutique (abonnement le plus récent, quel que
    -- soit son flag) doit avoir `has_advanced_stock_alerts` — même piège
    -- qu'un `exists (... where flag is true ...)` l'aurait raté : ça
    -- trouverait un vieil abonnement Pro (flag vrai) même après un
    -- downgrade vers un plan sans ce flag. On sélectionne d'abord LA
    -- ligne la plus récente, puis on lit son flag — même principe que
    -- `get_order_notification_info` (migration 0020).
    and coalesce(
      (
        select (sp.features->>'has_advanced_stock_alerts')::boolean
        from subscriptions sub
        join subscription_plans sp on sp.id = sub.plan_id
        where sub.shop_id = s.id
        order by sub.started_at desc
        limit 1
      ),
      false
    );
$$;

grant execute on function public.get_low_stock_alert_info(uuid) to anon, authenticated;
