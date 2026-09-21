-- ============================================================================
-- Trois demandes d'Isaac du 21/09/2026, après avoir posé deux questions sur
-- le suivi de commande côté client :
--
-- 1) "Annulation à tout moment" par le client — implémentée avec une limite
--    volontaire (choix assumé, pas demandé explicitement par Isaac mais jugé
--    nécessaire) : impossible d'annuler une commande déjà `delivered` (rien
--    à annuler, le produit est déjà entre les mains du client) ni déjà
--    `cancelled` (pas de double annulation). Réalisable tant que le statut
--    est `pending`, `paid` ou `preparing`.
-- 2) Avis client déclenché uniquement après livraison — "un client n'a pas
--    le droit de mettre son avis alors qu'il n'a même pas encore touché le
--    produit". `submit_product_review` (migration 0011) ne vérifiait jusqu'ici
--    que la présence du produit dans la commande, jamais son statut.
-- 3) Un vrai espace de notification ("qui concerne tout", pas seulement les
--    commandes en attente) : la table `notifications` existe depuis
--    0001_init.sql (RLS déjà en place) mais n'était encore utilisée nulle
--    part dans le code — ajout de `link`/`kind` pour pouvoir router un clic
--    vers la bonne page et distinguer visuellement le type d'événement.
--
-- Sécurité de `cancel_order`, même modèle que `submit_product_review`
-- (documenté dans ce fichier depuis 0011) : la possession de l'UUID de
-- commande (lien de confirmation) fait office de jeton de consultation ET
-- d'action pour un client sans compte — aucune vérification supplémentaire
-- (téléphone, session) n'est demandée, cohérent avec le reste du tunnel de
-- commande "invité" qui n'a jamais requis de compte.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) notifications : colonnes de routage/catégorisation.
-- ----------------------------------------------------------------------------
alter table notifications add column if not exists link text;
alter table notifications add column if not exists kind text not null default 'info';

alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check
  check (kind in ('new_order', 'order_cancelled', 'status_change', 'review_ready', 'admin_message', 'info'));

-- ----------------------------------------------------------------------------
-- 2) create_order : signature INCHANGÉE depuis 0023_promo_codes.sql (10
-- paramètres, mêmes types/défauts) — `create or replace function` sur une
-- signature identique préserve les grants déjà accordés (`anon`,
-- `authenticated`), pas besoin de les répéter ici (même choix que 0023).
-- Corps repris à l'identique, seul ajout : récupération de `owner_id` de la
-- boutique (même select que `delivery_fee`, pas de requête supplémentaire) et
-- notification au vendeur juste avant de retourner l'id de la commande.
-- ----------------------------------------------------------------------------
create or replace function public.create_order(
  p_shop_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_payment_method text,
  p_items jsonb,
  p_delivery_lat double precision default null,
  p_delivery_lng double precision default null,
  p_customer_email text default null,
  p_promo_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_item jsonb;
  v_product products%rowtype;
  v_variant product_variants%rowtype;
  v_variant_id uuid;
  v_variant_id_text text;
  v_quantity integer;
  v_unit_price numeric(12, 2);
  v_total numeric(12, 2) := 0;
  v_order_item_id uuid;
  v_seen_group_names text[];
  v_delivery_fee numeric(12, 2);
  v_promo promo_codes%rowtype;
  v_discount numeric(12, 2) := 0;
  v_can_use_promo_codes boolean;
  v_shop_owner_id uuid;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Le panier est vide';
  end if;

  if p_payment_method not in ('mobile_money', 'cash_on_delivery') then
    raise exception 'Mode de paiement invalide';
  end if;

  if coalesce(trim(p_customer_name), '') = '' or coalesce(trim(p_customer_phone), '') = '' then
    raise exception 'Nom et téléphone du client requis';
  end if;

  select coalesce(delivery_fee, 0), owner_id into v_delivery_fee, v_shop_owner_id
    from shops
    where id = p_shop_id and status = 'active';

  if not found then
    raise exception 'Boutique introuvable ou inactive';
  end if;

  insert into orders (
    shop_id, customer_name, customer_phone, customer_email, delivery_address,
    payment_method, total_amount, status, delivery_lat, delivery_lng, delivery_fee,
    customer_id
  )
  values (
    p_shop_id, trim(p_customer_name), trim(p_customer_phone),
    nullif(trim(coalesce(p_customer_email, '')), ''), nullif(trim(p_delivery_address), ''),
    p_payment_method, 0, 'pending', p_delivery_lat, p_delivery_lng, v_delivery_fee,
    auth.uid()
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Quantité invalide';
    end if;

    select * into v_product
      from products
      where id = (v_item->>'product_id')::uuid
        and shop_id = p_shop_id
        and is_active = true
        and deleted_at is null
      for update;

    if not found then
      raise exception 'Un des produits du panier n''est plus disponible';
    end if;

    if v_product.stock < v_quantity then
      raise exception 'Stock insuffisant pour "%": % restant(s)', v_product.title, v_product.stock;
    end if;

    v_unit_price := v_product.price;
    v_seen_group_names := array[]::text[];

    if v_item ? 'variant_ids' and jsonb_typeof(v_item->'variant_ids') = 'array' then
      for v_variant_id_text in select * from jsonb_array_elements_text(v_item->'variant_ids')
      loop
        v_variant_id := v_variant_id_text::uuid;

        select * into v_variant
          from product_variants
          where id = v_variant_id and product_id = v_product.id;

        if not found then
          raise exception 'Variante invalide pour "%"', v_product.title;
        end if;

        if v_variant.name = any(v_seen_group_names) then
          raise exception 'Une seule option "%" à la fois pour "%"', v_variant.name, v_product.title;
        end if;
        v_seen_group_names := array_append(v_seen_group_names, v_variant.name);

        v_unit_price := v_unit_price + coalesce(v_variant.extra_price, 0);
      end loop;
    end if;

    update products
      set stock = stock - v_quantity, updated_at = now()
      where id = v_product.id;

    insert into order_items (order_id, product_id, quantity, unit_price)
    values (v_order_id, v_product.id, v_quantity, v_unit_price)
    returning id into v_order_item_id;

    if v_item ? 'variant_ids' and jsonb_typeof(v_item->'variant_ids') = 'array' then
      insert into order_item_variants (order_item_id, variant_id)
      select v_order_item_id, elem::uuid
      from jsonb_array_elements_text(v_item->'variant_ids') as elem;
    end if;

    v_total := v_total + v_unit_price * v_quantity;
  end loop;

  if p_promo_code is not null and trim(p_promo_code) <> '' then
    select coalesce(
      (
        select (sp.features->>'can_use_promo_codes')::boolean
        from subscriptions sub
        join subscription_plans sp on sp.id = sub.plan_id
        where sub.shop_id = p_shop_id
        order by sub.started_at desc
        limit 1
      ),
      false
    ) into v_can_use_promo_codes;

    if not v_can_use_promo_codes then
      raise exception 'Code promo invalide ou expiré';
    end if;

    select * into v_promo
      from promo_codes
      where shop_id = p_shop_id
        and upper(code) = upper(trim(p_promo_code))
        and is_active = true
        and (expires_at is null or expires_at > now())
        and (max_uses is null or used_count < max_uses)
      for update;

    if not found then
      raise exception 'Code promo invalide ou expiré';
    end if;

    v_discount := case
      when v_promo.discount_type = 'percentage' then round(v_total * v_promo.discount_value / 100, 2)
      else v_promo.discount_value
    end;
    v_discount := least(v_discount, v_total);

    update promo_codes set used_count = used_count + 1 where id = v_promo.id;

    v_total := v_total - v_discount;
  end if;

  v_total := v_total + v_delivery_fee;

  update orders
    set total_amount = v_total,
        promo_code_id = v_promo.id,
        discount_amount = v_discount
    where id = v_order_id;

  -- Notification vendeur — nouvelle, en plus de l'email existant
  -- (`get_order_notification_info`, 0013) : espace de notification unifié
  -- dans le dashboard, pas seulement une boîte mail à surveiller.
  insert into notifications (profile_id, title, body, link, kind)
  values (
    v_shop_owner_id,
    'Nouvelle commande reçue',
    format('%s — %s FCFA', trim(p_customer_name), v_total),
    '/dashboard/commandes/' || v_order_id,
    'new_order'
  );

  return v_order_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3) cancel_order : nouvelle RPC — annulation par le client, tant que la
-- commande n'est ni déjà livrée ni déjà annulée.
-- ----------------------------------------------------------------------------
create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_shop_owner_id uuid;
  v_customer_name text;
begin
  select o.status, o.customer_name, s.owner_id
    into v_status, v_customer_name, v_shop_owner_id
    from orders o
    join shops s on s.id = o.shop_id
    where o.id = p_order_id;

  if not found then
    raise exception 'Commande introuvable';
  end if;

  if v_status = 'cancelled' then
    raise exception 'Cette commande est déjà annulée';
  end if;

  if v_status = 'delivered' then
    raise exception 'Impossible d''annuler une commande déjà livrée';
  end if;

  update orders set status = 'cancelled', updated_at = now() where id = p_order_id;

  insert into notifications (profile_id, title, body, link, kind)
  values (
    v_shop_owner_id,
    'Commande annulée par le client',
    format('%s a annulé sa commande.', v_customer_name),
    '/dashboard/commandes/' || p_order_id,
    'order_cancelled'
  );
end;
$$;

grant execute on function public.cancel_order(uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4) submit_product_review : ajout du garde-fou "commande livrée" — signature
-- inchangée depuis 0011 (grant déjà en place, pas besoin de le répéter).
-- ----------------------------------------------------------------------------
create or replace function public.submit_product_review(
  p_order_id uuid,
  p_product_id uuid,
  p_rating integer,
  p_comment text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_name text;
  v_status text;
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'La note doit être comprise entre 1 et 5';
  end if;

  select o.customer_name, o.status into v_customer_name, v_status
    from orders o
    join order_items oi on oi.order_id = o.id
    where o.id = p_order_id and oi.product_id = p_product_id
    limit 1;

  if v_customer_name is null then
    raise exception 'Cette commande ne contient pas ce produit';
  end if;

  if v_status <> 'delivered' then
    raise exception 'Tu pourras laisser un avis une fois ta commande marquée comme livrée';
  end if;

  insert into product_reviews (product_id, order_id, customer_name, rating, comment)
  values (p_product_id, p_order_id, v_customer_name, p_rating, nullif(trim(coalesce(p_comment, '')), ''))
  on conflict (order_id, product_id)
  do update set rating = excluded.rating, comment = excluded.comment, created_at = now();
end;
$$;

-- ----------------------------------------------------------------------------
-- 5) handle_new_user() : reconnaît aussi le nom/la photo renvoyés par un
-- fournisseur OAuth (Google — voir "Connexion avec Google" dans
-- decisions-techniques.md) en plus de `display_name` (formulaire email/mdp).
-- Google renvoie `full_name`/`name`/`avatar_url`/`picture` dans
-- `raw_user_meta_data`, jamais `display_name` ni `phone` : sans ce
-- changement, un compte créé via Google affichait la partie locale de son
-- adresse email comme nom, jamais son vrai nom Google. Le rôle n'est PAS
-- géré ici (Google ne transmet aucune métadonnée `role` exploitable) — voir
-- `src/app/auth/callback/route.ts` pour la correction du rôle 'customer'
-- côté portail client, faite après coup plutôt que dans ce trigger.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requested_role text := new.raw_user_meta_data->>'role';
  v_display_name text := coalesce(
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(new.email, '@', 1),
    new.phone,
    'Utilisateur'
  );
  v_avatar_url text := nullif(trim(coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture'
  )), '');
  v_role text := case when v_requested_role = 'customer' then 'customer' else 'vendor' end;
  v_phone text := nullif(trim(new.raw_user_meta_data->>'phone'), '');
begin
  begin
    insert into public.profiles (id, display_name, phone, role, avatar_url)
    values (new.id, v_display_name, v_phone, v_role, v_avatar_url)
    on conflict (id) do nothing;
  exception when unique_violation then
    insert into public.profiles (id, display_name, role, avatar_url)
    values (new.id, v_display_name, v_role, v_avatar_url)
    on conflict (id) do nothing;
  end;

  return new;
end;
$$;
