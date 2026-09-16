-- ============================================================================
-- Multi-utilisateurs (`can_multi_user`/`max_collaborators`, plan Pro) —
-- 16/09/2026. Un collaborateur invité par email peut se connecter avec son
-- propre compte et gérer le catalogue et les commandes de la boutique, sans
-- jamais devenir "propriétaire". Périmètre volontairement borné pour cette
-- première version (voir decisions-techniques.md pour le détail complet) :
-- un collaborateur peut lire/écrire produits et commandes, mais PAS les
-- réglages boutique, l'abonnement, les paiements, les codes promo, ni la
-- gestion des autres collaborateurs — réservés au propriétaire.
-- ============================================================================

create table if not exists shop_collaborators (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  -- `null` tant que l'invitation n'est pas acceptée (voir
  -- accept_shop_collaboration ci-dessous) — on ne connaît que l'email avant
  -- que la personne invitée n'ait un compte ou ne se soit connectée.
  user_id uuid references profiles (id) on delete cascade,
  invited_email text not null,
  status text not null default 'pending' check (status in ('pending', 'active')),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (shop_id, invited_email)
);

create index if not exists shop_collaborators_shop_id_idx on shop_collaborators (shop_id);
create index if not exists shop_collaborators_user_id_idx on shop_collaborators (user_id);

alter table shop_collaborators enable row level security;

-- Le propriétaire gère entièrement ses invitations (créer, lister, retirer).
create policy "shop_collaborators_owner_manage" on shop_collaborators for all using (
  exists (select 1 from shops where shops.id = shop_collaborators.shop_id and shops.owner_id = auth.uid())
) with check (
  exists (select 1 from shops where shops.id = shop_collaborators.shop_id and shops.owner_id = auth.uid())
);

-- La personne invitée voit sa propre ligne (pour savoir qu'elle a une
-- invitation en attente, avant même d'avoir `user_id` renseigné) — jamais
-- d'UPDATE direct côté client : l'acceptation passe par la fonction
-- `security definer` ci-dessous, pas par une écriture RLS classique (une
-- policy `for update` ne peut pas garantir qu'elle ne touche QUE `user_id`
-- et `status`, une RPC dédiée si).
create policy "shop_collaborators_self_read" on shop_collaborators for select using (
  user_id = auth.uid() or invited_email = auth.jwt() ->> 'email'
);

-- `is_shop_collaborator` : vraie SEULEMENT si (a) une ligne active existe
-- pour cet utilisateur sur cette boutique ET (b) le plan ACTUEL de la
-- boutique a toujours `can_multi_user` — un downgrade depuis Pro coupe
-- l'accès des collaborateurs immédiatement, pas seulement l'invitation de
-- nouveaux. Même piège que pour les autres flags (migrations 0020/0021) :
-- on lit LE plan le plus récent, pas "un plan qui a le flag à true".
create or replace function public.is_shop_collaborator(p_shop_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from shop_collaborators sc
    where sc.shop_id = p_shop_id and sc.user_id = auth.uid() and sc.status = 'active'
  )
  and coalesce(
    (
      select (sp.features->>'can_multi_user')::boolean
      from subscriptions sub
      join subscription_plans sp on sp.id = sub.plan_id
      where sub.shop_id = p_shop_id
      order by sub.started_at desc
      limit 1
    ),
    false
  );
$$;

-- Accepter une invitation — RPC plutôt qu'un UPDATE direct (voir plus haut) :
-- ne touche QUE `user_id`/`status`/`accepted_at`, sur LA ligne correspondant
-- à l'email du compte connecté, et seulement si elle est encore "pending".
create or replace function public.accept_shop_collaboration(p_shop_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := auth.jwt() ->> 'email';
begin
  if v_email is null then
    raise exception 'Session invalide';
  end if;

  update shop_collaborators
  set user_id = auth.uid(), status = 'active', accepted_at = now()
  where shop_id = p_shop_id
    and invited_email = v_email
    and status = 'pending';

  if not found then
    raise exception 'Invitation introuvable ou déjà utilisée';
  end if;
end;
$$;

grant execute on function public.accept_shop_collaboration(uuid) to authenticated;

-- Étend l'accès produits/commandes (lecture ET écriture) aux collaborateurs
-- actifs — policies ADDITIONNELLES (jamais de modification des policies
-- `_owner_*` existantes) : Postgres combine plusieurs policies permissives
-- pour une même action en OR, donc le propriétaire garde exactement le même
-- accès qu'avant, et un collaborateur actif obtient le même accès en plus.
create policy "products_collaborator_all" on products for all using (
  is_shop_collaborator(shop_id)
) with check (
  is_shop_collaborator(shop_id)
);

create policy "product_images_collaborator_all" on product_images for all using (
  exists (select 1 from products where products.id = product_images.product_id and is_shop_collaborator(products.shop_id))
);

create policy "product_variants_collaborator_all" on product_variants for all using (
  exists (select 1 from products where products.id = product_variants.product_id and is_shop_collaborator(products.shop_id))
);

create policy "orders_collaborator_read" on orders for select using (
  is_shop_collaborator(shop_id)
);
create policy "orders_collaborator_update" on orders for update using (
  is_shop_collaborator(shop_id)
);

create policy "order_items_collaborator_read" on order_items for select using (
  exists (select 1 from orders where orders.id = order_items.order_id and is_shop_collaborator(orders.shop_id))
);

create policy "order_item_variants_collaborator_read" on order_item_variants for select using (
  exists (
    select 1 from order_items
    join orders on orders.id = order_items.order_id
    where order_items.id = order_item_variants.order_item_id and is_shop_collaborator(orders.shop_id)
  )
);
