-- ============================================================================
-- Codes promo (`can_use_promo_codes`, plan Pro) — 16/09/2026. Spec tranchée
-- par Isaac : réduction en pourcentage OU en montant fixe, au choix du
-- vendeur à la création de chaque code.
-- ============================================================================

create table if not exists promo_codes (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  code text not null,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(12, 2) not null check (discount_value > 0),
  -- Un pourcentage > 100% n'a pas de sens ; un montant fixe, lui, n'a pas
  -- de plafond intrinsèque (plafonné au sous-total au moment de l'usage,
  -- voir create_order plus bas — jamais un total négatif).
  constraint promo_codes_percentage_max check (
    discount_type <> 'percentage' or discount_value <= 100
  ),
  is_active boolean not null default true,
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (shop_id, code)
);

create index if not exists promo_codes_shop_id_idx on promo_codes (shop_id);

alter table promo_codes enable row level security;

-- Le vendeur gère ses propres codes (CRUD complet) — aucune policy de
-- lecture publique/anon : la validation d'un code au checkout se fait DANS
-- `create_order` (`security definer`), jamais par une requête directe du
-- client sur cette table (qui exposerait le detail_type/valeur de tous les
-- codes d'une boutique à n'importe qui).
create policy "promo_codes_owner_all" on promo_codes for all using (
  exists (select 1 from shops where shops.id = promo_codes.shop_id and shops.owner_id = auth.uid())
) with check (
  exists (select 1 from shops where shops.id = promo_codes.shop_id and shops.owner_id = auth.uid())
);

-- Traçabilité sur la commande : quel code a été utilisé, quel rabais a
-- réellement été appliqué (utile pour l'export CSV commandes et le futur
-- suivi de performance des codes par le vendeur).
alter table orders
  add column if not exists promo_code_id uuid references promo_codes (id) on delete set null,
  add column if not exists discount_amount numeric(12, 2) not null default 0;

-- `create_order` : ajoute `p_promo_code` en dernier paramètre AVEC valeur par
-- défaut (`null`) — un nouveau paramètre par défaut ne casse aucun appelant
-- existant, contrairement à un changement de type de retour (voir le
-- raisonnement dans 0021_stock_alert_threshold.sql pour le même genre de
-- contrainte). Corps repris à l'identique de la version 0014
-- (customer_accounts.sql), avec uniquement l'ajout du calcul de rabais juste
-- avant la mise à jour finale de `total_amount`.
--
-- Un code invalide/expiré/épuisé ET un code soumis alors que le plan de la
-- boutique n'a pas `can_use_promo_codes` renvoient la MÊME erreur générique
-- — jamais de distinction qui laisserait deviner à un client si un code
-- existe mais est simplement hors plan.
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

  select coalesce(delivery_fee, 0) into v_delivery_fee
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

  -- Code promo — appliqué sur le sous-total produits, AVANT frais de
  -- livraison (une réduction sur les frais de livraison n'a pas été
  -- demandée). `for update` : deux commandes concurrentes avec le même code
  -- proche de `max_uses` ne doivent pas toutes les deux passer.
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
    -- Jamais un total négatif : un montant fixe supérieur au sous-total
    -- annule simplement le sous-total, pas plus.
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

  return v_order_id;
end;
$$;
