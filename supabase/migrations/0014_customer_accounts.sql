-- ============================================================================
-- Comptes client optionnels (15/09/2026) — demandé par Isaac : "on peut
-- proposer un compte aux clients, mais pas obligatoire pour juste passer
-- une commande".
--
-- Principe non négociable : la commande "invité" (sans compte) reste le
-- chemin par défaut et n'est jamais touchée par cette migration —
-- create_order continue de fonctionner à l'identique pour `anon`. Un compte
-- client est une couche additive au-dessus, pour qui veut retrouver son
-- historique de commandes plus tard (aujourd'hui, perdre le lien de
-- confirmation = perdre l'accès à sa commande, ce qui est le vrai problème
-- que ça règle).
--
-- Choix d'architecture : un compte client PLATEFORME (pas par boutique),
-- pour rester cohérent avec le fait que c'est un SaaS multi-vendeurs — un
-- client crée un compte une fois et retrouve ses achats chez n'importe quel
-- vendeur du réseau, comme chez Jumia. On réutilise `profiles` (déjà utilisé
-- pour vendeur/admin) plutôt qu'une table séparée : même mécanique
-- d'auth.users + trigger handle_new_user(), un simple rôle en plus.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Nouveau rôle 'customer' sur profiles.
-- ----------------------------------------------------------------------------
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('vendor', 'admin', 'customer'));

-- handle_new_user() : capture désormais aussi le téléphone (saisi à
-- l'inscription client, cf. compte/inscription-form.tsx) et le rôle demandé
-- — MAIS seulement 'customer' peut être auto-attribué via les métadonnées
-- envoyées par le navigateur à signUp(). Toute autre valeur (notamment
-- 'admin') retombe sur le défaut 'vendor', pour ne pas ouvrir une nouvelle
-- voie d'auto-élévation de privilège après celle corrigée en
-- 0008_prevent_privilege_escalation.sql — les métadonnées `raw_user_meta_data`
-- sont fournies par le client, donc jamais dignes de confiance au-delà de
-- cette liste blanche explicite.
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
    split_part(new.email, '@', 1),
    new.phone,
    'Utilisateur'
  );
  v_role text := case when v_requested_role = 'customer' then 'customer' else 'vendor' end;
  v_phone text := nullif(trim(new.raw_user_meta_data->>'phone'), '');
begin
  -- `profiles.phone` est unique sur toute la plateforme (vendeurs ET
  -- clients confondus, même table) : un client qui saisit à l'inscription
  -- un numéro déjà utilisé par un autre profil ne doit jamais se retrouver
  -- avec un compte non créé pour autant — l'erreur remontée par
  -- supabase.auth.signUp() dans ce cas est générique côté GoTrue, impossible
  -- à distinguer proprement côté formulaire. On absorbe le conflit ici :
  -- le compte est créé sans téléphone plutôt que pas créé du tout.
  begin
    insert into public.profiles (id, display_name, phone, role)
    values (new.id, v_display_name, v_phone, v_role)
    on conflict (id) do nothing;
  exception when unique_violation then
    insert into public.profiles (id, display_name, role)
    values (new.id, v_display_name, v_role)
    on conflict (id) do nothing;
  end;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2) orders.customer_id — lien optionnel vers un compte client.
-- ----------------------------------------------------------------------------
alter table orders add column if not exists customer_id uuid references profiles (id) on delete set null;

create index if not exists orders_customer_id_idx on orders (customer_id);

-- create_order : signature INCHANGÉE (aucun paramètre client à ajouter,
-- volontairement) — `customer_id` est déduit de auth.uid() côté serveur, à
-- l'intérieur de la fonction, jamais transmis par le navigateur. Pour un
-- appel anonyme (client invité), auth.uid() vaut simplement null, donc la
-- commande reste "sans compte" exactement comme avant. Pour un navigateur où
-- une session client est active, la commande est rattachée automatiquement
-- au compte, sans rien changer côté cart-checkout.tsx : le client Supabase
-- y attache déjà le JWT de session s'il y en a une.
create or replace function public.create_order(
  p_shop_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_payment_method text,
  p_items jsonb,
  p_delivery_lat double precision default null,
  p_delivery_lng double precision default null,
  p_customer_email text default null
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

  v_total := v_total + v_delivery_fee;

  update orders set total_amount = v_total where id = v_order_id;

  return v_order_id;
end;
$$;

-- Signature inchangée -> droits déjà accordés (0012) restent valides, pas de
-- nouveau grant nécessaire.

-- ----------------------------------------------------------------------------
-- 3) RLS : un client connecté lit ses propres commandes directement (pas
-- besoin de RPC à jeton ici, contrairement au flux invité — auth.uid() est
-- une preuve d'identité suffisante). Additive, comme product_reviews_owner_read
-- en 0013 : ne touche pas aux policies existantes réservées au vendeur.
-- ----------------------------------------------------------------------------
create policy "orders_customer_read" on orders for select using (auth.uid() = customer_id);

create policy "order_items_customer_read" on order_items for select using (
  exists (
    select 1 from orders
    where orders.id = order_items.order_id and orders.customer_id = auth.uid()
  )
);

create policy "order_item_variants_customer_read" on order_item_variants for select using (
  exists (
    select 1
    from order_items oi
    join orders o on o.id = oi.order_id
    where oi.id = order_item_variants.order_item_id and o.customer_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- 4) Rattachement des commandes passées en invité, une fois un compte créé.
--
-- Comparaison par numéro de téléphone normalisé (chiffres uniquement, 10
-- derniers) plutôt qu'un simple `=` texte : un client tape son numéro
-- différemment d'une commande à l'autre ("+225 07 00 00 00 00",
-- "0700000000", "07 00 00 00 00"...). Égalité stricte sur le numéro
-- normalisé (pas une correspondance partielle/LIKE) pour éviter tout
-- rattachement erroné à la commande de quelqu'un d'autre.
-- ----------------------------------------------------------------------------
create or replace function public.normalize_phone_ci(p_phone text)
returns text
language sql
immutable
as $$
  select right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
$$;

-- security definer : nécessaire pour mettre à jour des lignes `orders` qui
-- appartiennent à d'autres commandes invité, hors de portée de RLS pour le
-- client (il n'a par définition pas encore de droit dessus). Reste sûr car
-- entièrement piloté par auth.uid() et le téléphone de SON PROPRE profil —
-- rien de fourni par l'appelant ne détermine quelles lignes sont modifiées.
create or replace function public.claim_guest_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_normalized text;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;

  select phone into v_phone from profiles where id = auth.uid();
  v_normalized := public.normalize_phone_ci(v_phone);

  if v_normalized = '' or length(v_normalized) < 8 then
    return 0;
  end if;

  update orders
    set customer_id = auth.uid()
    where customer_id is null
      and public.normalize_phone_ci(customer_phone) = v_normalized;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.claim_guest_orders() to authenticated;
