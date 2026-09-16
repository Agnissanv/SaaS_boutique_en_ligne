-- ============================================================================
-- Enrichissement des statistiques (16/09/2026) — suite directe de
-- 0025_advanced_stats.sql. Isaac, après avoir vu la première version de
-- `/dashboard/statistiques` : "je veux que les stats soit vraiment complet
-- et très riche". Deux questions tranchées avec lui avant d'écrire cette
-- migration (voir decisions-techniques.md pour le détail complet) :
--
-- 1. "Client récurrent"/"meilleur client" : pas d'identifiant client fiable
--    pour une commande invitée (le compte client `orders.customer_id` est
--    optionnel, migration 0014, et la majorité des commandes n'en ont pas).
--    Seul `orders.customer_phone` est toujours saisi (utilisé pour le
--    contact WhatsApp) -> regroupement par numéro de téléphone, en acceptant
--    l'imprécision qu'un même client avec deux numéros compte comme deux.
-- 2. Répartition Business/Pro : "Business enrichi, Pro encore plus complet"
--    (les deux options recommandées, choisies par Isaac).
--
-- Toutes les fonctions ci-dessous sont appelées depuis une session vendeur
-- déjà authentifiée (jamais depuis la marketplace publique) : comme
-- `get_shop_best_sellers` (0025), elles restent en mode par défaut
-- ("security invoker", PAS "security definer") pour que les policies RLS
-- existantes (propriétaire OU collaborateur actif, 0024_shop_collaborators)
-- s'appliquent automatiquement, sans dupliquer cette logique d'accès ici.
-- ============================================================================

-- `p_since` ajouté en dernier paramètre AVEC valeur par défaut (`null`) :
-- changement de signature sans casser l'appel existant (page Statistiques
-- v1, qui appelle sans p_since). `null` = depuis toujours (utilisé pour la
-- liste des produits jamais vendus, qui a besoin du classement complet sur
-- toute la durée de vie de la boutique) ; une date = borne basse (utilisé
-- pour le nouveau sélecteur de période 7/30/90 jours).
create or replace function public.get_shop_best_sellers(
  p_shop_id uuid,
  p_limit integer default 5,
  p_since timestamptz default null
)
returns table (product_id uuid, title text, quantity_sold bigint)
language sql
stable
as $$
  select p.id, p.title, sum(oi.quantity)::bigint as quantity_sold
  from order_items oi
  join orders o on o.id = oi.order_id
  join products p on p.id = oi.product_id
  where o.shop_id = p_shop_id
    and o.status != 'cancelled'
    and (p_since is null or o.created_at >= p_since)
  group by p.id, p.title
  order by quantity_sold desc
  limit p_limit;
$$;

grant execute on function public.get_shop_best_sellers(uuid, integer, timestamptz) to authenticated;

-- Répartition du CA et des quantités vendues par catégorie (Business) —
-- `products.category` est un simple `text` nullable (aucune contrainte en
-- base, voir 0015_more_categories_and_bestsellers.sql), regroupé sous
-- "Non catégorisé" quand absent plutôt que d'exclure ces produits.
create or replace function public.get_shop_category_breakdown(
  p_shop_id uuid,
  p_since timestamptz
)
returns table (category text, revenue numeric, quantity_sold bigint)
language sql
stable
as $$
  select
    coalesce(p.category, 'Non catégorisé') as category,
    sum(oi.quantity * oi.unit_price)::numeric as revenue,
    sum(oi.quantity)::bigint as quantity_sold
  from order_items oi
  join orders o on o.id = oi.order_id
  join products p on p.id = oi.product_id
  where o.shop_id = p_shop_id
    and o.status != 'cancelled'
    and o.created_at >= p_since
  group by coalesce(p.category, 'Non catégorisé')
  order by revenue desc;
$$;

grant execute on function public.get_shop_category_breakdown(uuid, timestamptz) to authenticated;

-- Meilleurs clients par dépense cumulée, depuis toujours (Pro) — regroupés
-- par téléphone (voir raisonnement en tête de fichier). Le nom affiché est
-- celui de la commande la plus récente de ce numéro (un client peut changer
-- de nom d'une commande à l'autre — invité à chaque fois — donc on prend le
-- plus à jour plutôt qu'un nom arbitraire).
create or replace function public.get_shop_top_customers(
  p_shop_id uuid,
  p_limit integer default 5
)
returns table (customer_phone text, customer_name text, total_spent numeric, order_count bigint)
language sql
stable
as $$
  select
    o.customer_phone,
    (array_agg(o.customer_name order by o.created_at desc))[1] as customer_name,
    sum(o.total_amount)::numeric as total_spent,
    count(*)::bigint as order_count
  from orders o
  where o.shop_id = p_shop_id
    and o.status != 'cancelled'
  group by o.customer_phone
  order by total_spent desc
  limit p_limit;
$$;

grant execute on function public.get_shop_top_customers(uuid, integer) to authenticated;

-- Clients uniques / nouveaux / récurrents sur une période (Pro) — "récurrent"
-- = ce numéro de téléphone a déjà commandé (statut non annulé) AVANT le
-- début de la période ; "nouveau" = sa toute première commande tombe dans la
-- période. Même regroupement par téléphone que get_shop_top_customers.
create or replace function public.get_shop_customer_period_stats(
  p_shop_id uuid,
  p_since timestamptz
)
returns table (unique_customers bigint, new_customers bigint, returning_customers bigint)
language sql
stable
as $$
  with period_customers as (
    select distinct o.customer_phone
    from orders o
    where o.shop_id = p_shop_id
      and o.status != 'cancelled'
      and o.created_at >= p_since
  ),
  classified as (
    select
      pc.customer_phone,
      exists (
        select 1 from orders o2
        where o2.shop_id = p_shop_id
          and o2.status != 'cancelled'
          and o2.customer_phone = pc.customer_phone
          and o2.created_at < p_since
      ) as is_returning
    from period_customers pc
  )
  select
    count(*)::bigint as unique_customers,
    count(*) filter (where not is_returning)::bigint as new_customers,
    count(*) filter (where is_returning)::bigint as returning_customers
  from classified;
$$;

grant execute on function public.get_shop_customer_period_stats(uuid, timestamptz) to authenticated;
