-- ============================================================================
-- Statistique "trafic par source" (22/09/2026, suite de l'audit croissance :
-- "qu'est-ce qui manque pour que mes utilisateurs se sentent à l'aise de
-- prendre un abonnement payant ?"). Répond à la question qu'un vendeur pose
-- naturellement une fois qu'il paie un abonnement : "est-ce que mon lien
-- WhatsApp/Instagram amène vraiment des visiteurs sur ma boutique ?" —
-- jusqu'ici `shops.view_count` (migration 0005) est un compteur global sans
-- AUCUNE dimension de provenance, confirmé par lecture directe du code avant
-- de construire quoi que ce soit (même discipline que le reste de l'audit
-- croissance : jamais construire sur une supposition non vérifiée).
--
-- Portée volontairement limitée pour ce premier jet : ne suit QUE les canaux
-- que le VENDEUR partage lui-même (lien WhatsApp/Instagram/Facebook/TikTok
-- généré sur `/dashboard/boutique`, voir `ShareShopLinks` côté app) — pas
-- une tentative d'attribution complète de tout le trafic (recherche interne
-- marketplace, moteurs de recherche...). Le trafic marketplace interne
-- aurait exigé de faire porter un paramètre de source sur les cartes
-- produit/boutique partagées (`ProductCard`/`ShopCard`), qui servent aussi
-- ailleurs (favoris, panier, "vu récemment") — un paramètre codé en dur là
-- aurait pollué l'attribution de ces autres contextes. Reporté : ce trafic
-- reste comptabilisé dans le seau "Direct / autre" ci-dessous, jamais une
-- valeur inventée pour combler l'écart. Voir decisions-techniques.md.
-- ============================================================================

create table if not exists shop_page_views (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  source text not null default 'direct',
  created_at timestamptz not null default now()
);

create index if not exists shop_page_views_shop_id_created_at_idx
  on shop_page_views (shop_id, created_at desc);

alter table shop_page_views enable row level security;

-- Lecture : propriétaire ou collaborateur actif — même schéma que `orders`
-- (policies `orders_owner_read`/`orders_collaborator_read`, migrations
-- 0001/0024). Aucune policy d'insertion cliente : la fonction `security
-- definer` ci-dessous est le seul chemin d'écriture, exactement comme
-- `increment_shop_view` avant elle.
create policy "shop_page_views_owner_read" on shop_page_views for select using (
  exists (select 1 from shops where shops.id = shop_page_views.shop_id and shops.owner_id = auth.uid())
);
create policy "shop_page_views_collaborator_read" on shop_page_views for select using (
  is_shop_collaborator(shop_id)
);

-- `increment_shop_view` étendu avec un paramètre de source. On DROP
-- explicitement l'ancienne fonction à 1 argument avant de recréer : `create
-- or replace` n'écrase pas une fonction de signature différente, il en
-- empile une seconde (surcharge) — sans ce drop, les deux `increment_shop_view`
-- coexisteraient en base.
drop function if exists increment_shop_view(text);

create or replace function public.increment_shop_view(p_shop_slug text, p_source text default 'direct')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid;
  -- Seules ces valeurs sont un vrai canal suivi — un paramètre absent, mal
  -- formé ou inconnu retombe sur 'direct' : jamais de texte libre non
  -- validé stocké tel quel depuis un appel anonyme.
  v_source text := case
    when p_source in ('whatsapp', 'instagram', 'facebook', 'tiktok') then p_source
    else 'direct'
  end;
begin
  update shops
  set view_count = view_count + 1
  where slug = p_shop_slug and status = 'active'
  returning id into v_shop_id;

  if v_shop_id is not null then
    insert into shop_page_views (shop_id, source) values (v_shop_id, v_source);
  end if;
end;
$$;

grant execute on function public.increment_shop_view(text, text) to anon, authenticated;

-- Lecture agrégée pour le dashboard vendeur (`/dashboard/statistiques`,
-- Business+ comme le reste des graphiques). `security invoker` (comportement
-- par défaut) : les policies RLS ci-dessus s'appliquent normalement à
-- l'intérieur de la fonction — même principe que `get_shop_best_sellers`
-- (migration 0025), pas besoin de dupliquer ici la vérification d'accès.
create or replace function public.get_shop_traffic_sources(p_shop_id uuid)
returns table (source text, visits bigint)
language sql
stable
as $$
  select spv.source, count(*)::bigint as visits
  from shop_page_views spv
  where spv.shop_id = p_shop_id
  group by spv.source
  order by visits desc;
$$;

grant execute on function public.get_shop_traffic_sources(uuid) to authenticated;
