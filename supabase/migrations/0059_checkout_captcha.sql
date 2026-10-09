-- ============================================================================
-- Captcha à la commande (Cloudflare Turnstile) — étape 1/2
-- — 09/10/2026 (suite de l'audit de sécurité, point 5).
--
-- Contexte : `create_order` est appelable par n'importe qui avec la clé
-- publique. Les limites de 0055 freinent un script, mais pas un script qui
-- change de numéro à chaque commande. Seul un captcha vérifié côté serveur
-- l'arrête vraiment.
--
-- Fonctionnement :
--   1. Le navigateur affiche le widget Turnstile et obtient un jeton.
--   2. La Server Action `verifyCheckoutCaptcha` vérifie ce jeton auprès de
--      Cloudflare (clé secrète), puis crée un « laissez-passer » dans
--      `checkout_captcha_passes` (client service role).
--   3. Le navigateur appelle `create_order` avec `p_captcha_pass` : la
--      fonction consomme le laissez-passer (usage unique, 10 minutes).
--
-- Cette migration NE REND PAS encore le captcha obligatoire
-- (`checkout_captcha_required()` renvoie false) : le site déjà en ligne, qui
-- n'envoie pas de laissez-passer, continue de fonctionner. On l'active avec
-- la migration 0060, une fois le widget vérifié en production.
--
-- Nettoyage des surcharges : chaque ajout de paramètre (0006, 0012, 0023)
-- avait créé une NOUVELLE fonction `create_order` au lieu de remplacer
-- l'ancienne. Les versions à 6, 8 et 9 paramètres existaient toujours, sans
-- aucun des garde-fous ajoutés depuis (limites de 0055, captcha) : un appel
-- direct permettait de les contourner. On les supprime toutes et on recrée une
-- seule version. Les appels actuels (10 paramètres nommés) correspondent
-- toujours à la nouvelle fonction, dont le 11e paramètre a une valeur par défaut.
-- ============================================================================

-- Laissez-passer : RLS activé sans aucune policy, donc accessible uniquement
-- au service role (Server Action) et aux fonctions security definer.
create table if not exists public.checkout_captcha_passes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);
alter table public.checkout_captcha_passes enable row level security;
revoke all on public.checkout_captcha_passes from anon, authenticated;
create index if not exists checkout_captcha_passes_created_at_idx
  on public.checkout_captcha_passes (created_at);

-- Interrupteur : false ici, true avec la migration 0060.
create or replace function public.checkout_captcha_required()
returns boolean
language sql
stable
as $$
  select false;
$$;

drop function if exists public.create_order(uuid, text, text, text, text, jsonb);
drop function if exists public.create_order(uuid, text, text, text, text, jsonb, double precision, double precision);
drop function if exists public.create_order(uuid, text, text, text, text, jsonb, double precision, double precision, text);
drop function if exists public.create_order(uuid, text, text, text, text, jsonb, double precision, double precision, text, text);

-- Même corps que 0055 ; ajouts repérés par "-- 0059".
create function public.create_order(
  p_shop_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_payment_method text,
  p_items jsonb,
  p_delivery_lat double precision default null,
  p_delivery_lng double precision default null,
  p_customer_email text default null,
  p_promo_code text default null,
  p_captcha_pass uuid default null -- 0059
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
  v_captcha_pass_used uuid; -- 0059
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

  -- 0059 : laissez-passer anti-robot (captcha vérifié côté serveur, voir
  -- verifyCheckoutCaptcha). Usage unique : la ligne est supprimée ; si la
  -- commande échoue plus loin, la transaction est annulée et le laissez-passer
  -- redevient utilisable. Obligatoire seulement si
  -- checkout_captcha_required() renvoie true (migration 0060).
  if p_captcha_pass is not null then
    delete from checkout_captcha_passes
      where id = p_captcha_pass
        and created_at > now() - interval '10 minutes'
      returning id into v_captcha_pass_used;
  end if;

  if checkout_captcha_required() and v_captcha_pass_used is null then
    raise exception 'Vérification anti-robot manquante ou expirée. Recharge la page et réessaie.';
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

grant execute on function public.create_order(
  uuid, text, text, text, text, jsonb, double precision, double precision, text, text, uuid
) to anon, authenticated;
