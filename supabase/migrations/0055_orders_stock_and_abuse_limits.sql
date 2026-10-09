-- ============================================================================
-- Commandes : stock restitué à l'annulation + garde-fous anti-abus
-- — 09/10/2026 (audit de sécurité, points 5 et 6).
--
-- 1) STOCK À L'ANNULATION
--    `create_order` décrémente `products.stock` dès la commande, mais rien ne
--    le rendait quand la commande était annulée (par le client via
--    `cancel_order`, ou par le vendeur via `updateOrderStatus`) : chaque
--    annulation faisait perdre du stock pour de bon, et le compteur
--    `promo_codes.used_count` restait aussi consommé.
--    Un seul trigger sur `orders.status` couvre les deux chemins. Il gère aussi
--    le cas inverse (le vendeur repasse une commande annulée à un autre statut,
--    ce que `updateOrderStatus` permet) : le stock est alors re-réservé, et
--    refusé s'il n'y en a plus assez.
--    Limite connue (inchangée) : `create_order` ne décrémente que le stock du
--    PRODUIT, pas celui des variantes (`product_variants.stock`) — ce trigger
--    reste symétrique à ce comportement.
--
-- 2) GARDE-FOUS DANS `create_order`
--    La fonction est appelable par n'importe qui (`anon`) avec la clé publique,
--    sans limite : un script pouvait vider le stock d'une boutique et noyer le
--    vendeur de notifications. Ajouts, sans changer la signature (les droits
--    `grant execute` existants sont conservés par `create or replace`) :
--      - bornes de longueur (nom 100, adresse 500, email 254, code promo 50) ;
--      - téléphone : 8 à 15 chiffres ;
--      - coordonnées GPS dans des plages valides ;
--      - 50 lignes de panier maximum, 100 unités maximum par ligne ;
--      - 5 commandes EN ATTENTE maximum par numéro et par boutique sur 1 h ;
--      - 20 commandes maximum par numéro sur 1 h, toutes boutiques confondues
--        (via `check_rate_limit`, migration 0048).
--    Volontairement PAS de limite par boutique ni par IP : une limite par
--    boutique donnerait à un attaquant un moyen simple de bloquer les vraies
--    commandes d'une boutique, et une limite par IP bloquerait des clients
--    légitimes derrière la même IP mobile partagée (très courant en CI). La
--    vraie parade contre un script qui change de numéro à chaque commande
--    reste un captcha (Cloudflare Turnstile) — à ajouter côté application.
--
-- 3) `check_rate_limit` FERMÉE AU PUBLIC
--    Aucun `grant` explicite en 0048 : Postgres la rendait donc exécutable par
--    tout le monde, y compris `anon` via `/rest/v1/rpc/check_rate_limit` —
--    n'importe qui pouvait gonfler ou remettre à zéro les compteurs (bloquer le
--    formulaire de contact d'une IP, remplir la table...). Elle n'est appelée
--    que côté serveur (client service-role, src/lib/rate-limit.ts) et depuis
--    `create_order` (security definer) : aucun usage légitime n'est perdu.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Stock restitué / re-réservé selon les changements de statut
-- ----------------------------------------------------------------------------
create or replace function public.sync_stock_on_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line record;
begin
  -- Passage À "annulée" : on rend le stock et l'utilisation du code promo.
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update products p
      set stock = p.stock + lines.qty,
          updated_at = now()
      from (
        select product_id, sum(quantity) as qty
        from order_items
        where order_id = new.id
        group by product_id
      ) lines
      where p.id = lines.product_id;

    if new.promo_code_id is not null then
      update promo_codes
        set used_count = greatest(used_count - 1, 0)
        where id = new.promo_code_id;
    end if;

  -- Sortie de "annulée" (réactivation par le vendeur) : on re-réserve.
  elsif old.status = 'cancelled' and new.status is distinct from 'cancelled' then
    for v_line in
      select product_id, sum(quantity) as qty
      from order_items
      where order_id = new.id
      group by product_id
    loop
      update products
        set stock = stock - v_line.qty,
            updated_at = now()
        where id = v_line.product_id
          and stock >= v_line.qty;

      if not found and exists (select 1 from products where id = v_line.product_id) then
        raise exception 'Stock insuffisant pour réactiver cette commande';
      end if;
    end loop;

    if new.promo_code_id is not null then
      update promo_codes
        set used_count = used_count + 1
        where id = new.promo_code_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_sync_stock_on_status_change on orders;
create trigger orders_sync_stock_on_status_change
  after update of status on orders
  for each row
  execute function public.sync_stock_on_order_status_change();

-- ----------------------------------------------------------------------------
-- 2) create_order — même corps que 0031, garde-fous ajoutés (repérés par
--    "-- 0055").
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
  v_recent_pending integer; -- 0055
begin
  -- 0055 : le panier doit être un tableau JSON, de taille raisonnable.
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Le panier est vide';
  end if;

  if jsonb_array_length(p_items) > 50 then
    raise exception 'Trop d''articles dans le panier (50 maximum)';
  end if;

  if p_payment_method not in ('mobile_money', 'cash_on_delivery') then
    raise exception 'Mode de paiement invalide';
  end if;

  if coalesce(trim(p_customer_name), '') = '' or coalesce(trim(p_customer_phone), '') = '' then
    raise exception 'Nom et téléphone du client requis';
  end if;

  -- 0055 : bornes de longueur et formats.
  if length(trim(p_customer_name)) > 100 then
    raise exception 'Nom trop long (100 caractères maximum)';
  end if;

  if length(regexp_replace(p_customer_phone, '\D', '', 'g')) not between 8 and 15 then
    raise exception 'Numéro de téléphone invalide';
  end if;

  if length(coalesce(p_delivery_address, '')) > 500 then
    raise exception 'Adresse trop longue (500 caractères maximum)';
  end if;

  if length(coalesce(p_customer_email, '')) > 254 then
    raise exception 'Adresse email trop longue';
  end if;

  if length(coalesce(p_promo_code, '')) > 50 then
    raise exception 'Code promo invalide ou expiré';
  end if;

  if (p_delivery_lat is not null and p_delivery_lat not between -90 and 90)
    or (p_delivery_lng is not null and p_delivery_lng not between -180 and 180)
  then
    raise exception 'Position de livraison invalide';
  end if;

  select coalesce(delivery_fee, 0), owner_id into v_delivery_fee, v_shop_owner_id
    from shops
    where id = p_shop_id and status = 'active';

  if not found then
    raise exception 'Boutique introuvable ou inactive';
  end if;

  -- 0055 : limites par numéro de téléphone.
  select count(*) into v_recent_pending
    from orders
    where shop_id = p_shop_id
      and status = 'pending'
      and created_at > now() - interval '1 hour'
      and normalize_phone_ci(customer_phone) = normalize_phone_ci(p_customer_phone);

  if v_recent_pending >= 5 then
    raise exception 'Trop de commandes en attente avec ce numéro. Réessaie dans un moment ou contacte la boutique.';
  end if;

  if not check_rate_limit('create_order_phone', normalize_phone_ci(p_customer_phone), 20, 60) then
    raise exception 'Trop de commandes avec ce numéro. Réessaie dans un moment.';
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

    -- 0055 : plafond par ligne.
    if v_quantity > 100 then
      raise exception 'Quantité trop élevée (100 maximum par article)';
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

    -- Prix effectif : soldé si une promo datée est active maintenant, sinon
    -- le prix normal — même règle que `isSaleActive`/`getEffectivePrice`
    -- côté application (src/lib/products.ts).
    v_unit_price := case
      when v_product.sale_price is not null
        and (v_product.sale_starts_at is null or now() >= v_product.sale_starts_at)
        and (v_product.sale_ends_at is null or now() <= v_product.sale_ends_at)
      then v_product.sale_price
      else v_product.price
    end;
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

  -- Notification vendeur — voir 0030_order_cancellation_and_notifications.sql.
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
-- 3) check_rate_limit réservée au serveur
-- ----------------------------------------------------------------------------
revoke execute on function public.check_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, text, integer, integer) to service_role;
