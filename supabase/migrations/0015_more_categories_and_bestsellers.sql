-- ============================================================================
-- Round 2 de la refonte de la page d'accueil marketplace (15/09/2026).
-- Isaac, en revoyant la première refonte du jour : "la page est toujours
-- pauvre... je veux une vraie page de marketplace... nos catégories sont
-- très petites pour une grande marketplace, travaille beaucoup plus dessus".
--
-- Deux changements de schéma nécessaires pour ça :
-- 1. `shops.category` a une contrainte `check` qui liste explicitement les
--    valeurs autorisées (0001_init.sql) — étendue ici pour suivre les 18
--    nouvelles catégories ajoutées à `src/lib/categories.ts`. `products.category`
--    n'a PAS de contrainte équivalente (simple `text`), donc rien à faire
--    côté produit.
-- 2. Nouvelle RPC `get_best_selling_products` pour une bande "Meilleures
--    ventes" sur la page d'accueil — une vraie agrégation sur les commandes
--    réelles (`order_items`), jamais un classement inventé (même principe
--    que partout ailleurs dans ce projet : barre de santé du stock, chiffres
--    du hero, etc.).
-- ============================================================================

-- Le nom `shops_category_check` est celui généré par Postgres pour la
-- contrainte inline d'origine (`category text not null check (...)` dans
-- `create table shops`, 0001_init.sql) — confirmé par
-- `select conname from pg_constraint where conrelid = 'shops'::regclass`.
alter table shops drop constraint if exists shops_category_check;

alter table shops add constraint shops_category_check check (
  category in (
    'mode', 'mode_femme', 'mode_homme', 'mode_enfant', 'chaussures', 'bijoux',
    'beaute', 'sante_bienetre', 'electronique', 'telephonie', 'informatique',
    'electromenager', 'maison', 'decoration', 'cuisine', 'alimentation',
    'bebe', 'jouets', 'sport', 'auto_moto', 'bricolage_jardin', 'papeterie',
    'livres', 'autre'
  )
);

-- Meilleures ventes : agrège les quantités vendues par produit sur les
-- commandes non annulées (même définition que "CA plateforme"/le relevé de
-- paiements du dashboard vendeur — `status <> 'cancelled'`, une commande
-- encore `pending` compte déjà comme une vraie intention d'achat, pas
-- seulement les commandes déjà livrées). `security definer` + `grant ... to
-- anon` : même pattern que `increment_shop_view`/`get_order_receipt` — un
-- visiteur anonyme doit pouvoir lire ce classement sans jamais avoir accès
-- en lecture aux commandes elles-mêmes (RLS sur `order_items`/`orders`
-- réservée au vendeur propriétaire).
create or replace function public.get_best_selling_products(p_limit integer default 12)
returns table (product_id uuid, total_sold bigint)
language sql
security definer
set search_path = public
stable
as $$
  select oi.product_id, sum(oi.quantity)::bigint as total_sold
  from order_items oi
  join orders o on o.id = oi.order_id
  join products p on p.id = oi.product_id
  join shops s on s.id = p.shop_id
  where o.status <> 'cancelled'
    and p.is_active = true
    and p.deleted_at is null
    and s.status = 'active'
  group by oi.product_id
  order by total_sold desc
  limit p_limit;
$$;

grant execute on function public.get_best_selling_products(integer) to anon, authenticated;
