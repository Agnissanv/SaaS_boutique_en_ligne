-- ============================================================================
-- Vraies statistiques avec graphiques (`has_advanced_stats`/`has_full_stats`)
-- — 16/09/2026. Répond à un manque identifié par Isaac lui-même en comparant
-- KEVA à un logiciel de gestion concurrent : le cahier des charges promettait
-- déjà des "statistiques avancées" en Priorité 2 (produits les plus vus, taux
-- de conversion), jamais construites — `/dashboard` (Aperçu) affiche
-- aujourd'hui exactement les mêmes chiffres bruts à Starter, Business et Pro,
-- sans graphique et sans différenciation de plan. Seul l'export CSV
-- (`can_export_stats`, câblé le 16/09/2026) différenciait vraiment le Pro
-- jusqu'ici sur ce terrain.
--
-- Deux niveaux tranchés par Isaac :
-- - Business (`has_advanced_stats`) : courbe de CA, produits les plus
--   vendus/les plus vus, répartition des commandes par statut.
-- - Pro (`has_full_stats`, en plus du niveau Business) : taux de conversion
--   et comparaison de périodes (mois vs mois précédent).
--
-- Ajout de `products.view_count` : contrairement à `shops.view_count`
-- (existant depuis la migration 0005), rien ne trackait jusqu'ici les vues
-- PAR PRODUIT — nécessaire pour "produits les plus vus", qu'Isaac a demandé
-- de construire dans la foulée plutôt que de reporter. Même pattern que
-- `increment_shop_view` : `security definer` + `grant ... to anon`, un
-- visiteur anonyme doit pouvoir déclencher l'incrément sans policy RLS
-- d'UPDATE sur `products`.
-- ============================================================================

update subscription_plans
set features = features || '{"has_advanced_stats": false, "has_full_stats": false}'::jsonb
where code = 'starter';

update subscription_plans
set features = features || '{"has_advanced_stats": true, "has_full_stats": false}'::jsonb
where code = 'business';

update subscription_plans
set features = features || '{"has_advanced_stats": true, "has_full_stats": true}'::jsonb
where code = 'pro';

alter table products
  add column if not exists view_count integer not null default 0;

create or replace function public.increment_product_view(p_product_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update products set view_count = view_count + 1 where id = p_product_id;
$$;

grant execute on function public.increment_product_view(uuid) to anon, authenticated;

-- `get_shop_best_sellers` : PAS `security definer` (comportement par défaut,
-- "security invoker") — appelée depuis le dashboard par un vendeur déjà
-- authentifié, donc les policies RLS existantes sur `orders`/`order_items`
-- (propriétaire OU collaborateur actif, migrations 0001/0024) s'appliquent
-- normalement à l'intérieur de la fonction, sans avoir à dupliquer ici la
-- vérification `is_shop_collaborator`. Différent de `get_best_selling_products`
-- (migration 0015, `security definer` + `grant ... to anon`) : celle-ci sert
-- la page d'accueil PUBLIQUE à un visiteur anonyme sur TOUTE la marketplace,
-- ce qui exige au contraire de contourner RLS.
create or replace function public.get_shop_best_sellers(p_shop_id uuid, p_limit integer default 5)
returns table (product_id uuid, title text, quantity_sold bigint)
language sql
stable
as $$
  select p.id, p.title, sum(oi.quantity)::bigint as quantity_sold
  from order_items oi
  join orders o on o.id = oi.order_id
  join products p on p.id = oi.product_id
  where o.shop_id = p_shop_id and o.status != 'cancelled'
  group by p.id, p.title
  order by quantity_sold desc
  limit p_limit;
$$;

grant execute on function public.get_shop_best_sellers(uuid, integer) to authenticated;
