-- Refonte de /dashboard/statistiques (30/09/2026), inspirée d'une seconde
-- maquette générique ("Analytiques") envoyée par Isaac. Deux changements :
--
-- 1) `get_shop_best_sellers` retourne maintenant aussi le revenu généré par
--    chaque produit (`revenue`), pour fusionner en une seule liste "Top
--    produits" (vignette + vues + revenu + conversion%) ce qui était trois
--    listes séparées côté page ("les plus vendus", "les plus vus",
--    "meilleurs taux de conversion"). Seul appelant existant vérifié par
--    grep : `statistiques/page.tsx` — changement de signature sans risque
--    ailleurs. `DROP FUNCTION` requis avant `CREATE OR REPLACE` : Postgres
--    n'autorise pas de changer le type de retour d'une fonction existante
--    autrement (même contrainte déjà rencontrée pour `increment_shop_view`,
--    migration 0043).
--
-- 2) Nouvelle fonction `get_shop_customer_segments` : remplace le bloc
--    "Clients uniques / Nouveaux / Récurrents" (Pro) par 4 paliers plus
--    parlants, inspirés de la section "Clients par segment" de la maquette.
--    Le palier est basé sur le nombre de commandes CUMULÉ depuis toujours
--    (pas seulement sur la période choisie) — un client déjà fidèle le reste
--    même pendant un mois calme — parmi les clients ayant commandé au moins
--    une fois pendant la période. Seuils choisis par Claude (1 commande =
--    nouveau, 2-3 = occasionnel, 4-6 = régulier, 7+ = fidèle) : à ajuster si
--    Isaac les trouve mal calibrés une fois testés sur de vraies données.

drop function if exists public.get_shop_best_sellers(uuid, integer, timestamptz);

create or replace function public.get_shop_best_sellers(
  p_shop_id uuid,
  p_limit integer default 5,
  p_since timestamptz default null
)
returns table (product_id uuid, title text, quantity_sold bigint, revenue numeric)
language sql
stable
as $$
  select
    p.id,
    p.title,
    sum(oi.quantity)::bigint as quantity_sold,
    sum(oi.quantity * oi.unit_price)::numeric as revenue
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

-- Clients par segment (Pro, même périmètre que l'ancien bloc qu'elle
-- remplace) : parmi les clients ayant commandé pendant la période choisie,
-- classe chacun selon son nombre de commandes cumulé depuis toujours.
-- Même motif "security invoker" que le reste de ce fichier (RLS existantes
-- sur `orders` s'appliquent normalement).
create or replace function public.get_shop_customer_segments(
  p_shop_id uuid,
  p_since timestamptz
)
returns table (nouveau bigint, occasionnel bigint, regulier bigint, fidele bigint)
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
  lifetime_counts as (
    select
      pc.customer_phone,
      (
        select count(*) from orders o2
        where o2.shop_id = p_shop_id
          and o2.status != 'cancelled'
          and o2.customer_phone = pc.customer_phone
      ) as total_orders
    from period_customers pc
  )
  select
    count(*) filter (where total_orders = 1)::bigint as nouveau,
    count(*) filter (where total_orders between 2 and 3)::bigint as occasionnel,
    count(*) filter (where total_orders between 4 and 6)::bigint as regulier,
    count(*) filter (where total_orders >= 7)::bigint as fidele
  from lifetime_counts;
$$;

grant execute on function public.get_shop_customer_segments(uuid, timestamptz) to authenticated;
