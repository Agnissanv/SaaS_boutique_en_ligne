-- ============================================================================
-- Sélection de plusieurs variantes par article (une par groupe : Taille ET
-- Couleur), signalé par Isaac le 13/09/2026 en testant le tunnel de commande
-- réel : "les tailles et couleurs sont mélangées, le client ne peut pas
-- choisir une taille XL et une couleur".
--
-- Root cause : `order_items.variant_id` (0001_init.sql) ne référence qu'UNE
-- seule ligne `product_variants` à la fois, et le formulaire client
-- (`add-to-cart-form.tsx`) affichait toutes les variantes — Taille:S,
-- Taille:M, Couleur:Rouge, Couleur:Bleu... — mélangées dans un seul menu
-- déroulant, dont une seule entrée pouvait être choisie au total. Déjà
-- documenté comme limitation connue et volontairement non traitée pour le
-- MVP (decisions-techniques.md, "un vrai système de combinaisons... Priorité
-- 2"), mais ça bloque désormais un test réel : à corriger maintenant, pas
-- besoin d'attendre le vrai système de combinaisons Priorité 2 (qui
-- suivrait plutôt un stock par combinaison exacte façon Shopify — plus
-- lourd, pas nécessaire pour de petits vendeurs qui gèrent leur stock à
-- l'œil/via WhatsApp).
--
-- Fix choisi (léger, cohérent avec le reste du schéma) : un article de
-- commande peut désormais référencer PLUSIEURS variantes (une par groupe
-- `product_variants.name`), via une table de jointure plutôt qu'une colonne
-- unique. Le stock reste décrémenté au niveau du produit uniquement (déjà
-- le cas avant ce changement — `product_variants.stock` existe dans le
-- schéma mais n'a jamais été le stock réellement décrémenté par
-- `create_order`, qui décrémente `products.stock`) : pas de stock par
-- combinaison exacte (XL+Rouge séparé de XL+Bleu), volontairement, pour
-- rester simple.
-- ============================================================================

-- Aucune commande réelle en base à ce stade (RAZ de test le 13/09/2026) :
-- on retire directement la colonne plutôt que de la garder en doublon.
alter table order_items drop column if exists variant_id;

create table if not exists order_item_variants (
  order_item_id uuid not null references order_items (id) on delete cascade,
  variant_id uuid not null references product_variants (id),
  primary key (order_item_id, variant_id)
);

create index if not exists order_item_variants_order_item_id_idx
  on order_item_variants (order_item_id);

alter table order_item_variants enable row level security;

-- Même règle que `order_items_owner_read` (0001_init.sql) : seul le vendeur
-- propriétaire de la boutique concernée peut lire le détail des variantes
-- choisies sur ses commandes.
create policy "order_item_variants_owner_read" on order_item_variants for select using (
  exists (
    select 1
    from order_items oi
    join orders o on o.id = oi.order_id
    join shops s on s.id = o.shop_id
    where oi.id = order_item_variants.order_item_id and s.owner_id = auth.uid()
  )
);

-- `create_order` : `p_items` accepte maintenant `variant_ids` (tableau, 0 à N
-- entrées — une par groupe) au lieu de `variant_id` (un seul, ou null).
-- Validation ajoutée : deux variantes du même groupe (`product_variants.name`,
-- ex. deux "Taille" différentes) pour un même article sont refusées — un
-- article a exactement une valeur par groupe, jamais deux.
create or replace function public.create_order(
  p_shop_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_payment_method text,
  p_items jsonb, -- [{ "product_id": uuid, "variant_ids": [uuid, ...] (une par groupe), "quantity": int }, ...]
  p_delivery_lat double precision default null,
  p_delivery_lng double precision default null
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

  -- Vérifie que la boutique existe et est active avant de créer quoi que ce soit.
  if not exists (select 1 from shops where id = p_shop_id and status = 'active') then
    raise exception 'Boutique introuvable ou inactive';
  end if;

  insert into orders (
    shop_id, customer_name, customer_phone, delivery_address,
    payment_method, total_amount, status, delivery_lat, delivery_lng
  )
  values (
    p_shop_id, trim(p_customer_name), trim(p_customer_phone), nullif(trim(p_delivery_address), ''),
    p_payment_method, 0, 'pending', p_delivery_lat, p_delivery_lng
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Quantité invalide';
    end if;

    -- Verrou de ligne : deux commandes simultanées sur le même produit ne
    -- peuvent pas décrémenter le même stock au-delà de zéro (pas de survente).
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

    -- Valide chaque variante sélectionnée et additionne son supplément de
    -- prix, en refusant deux variantes du même groupe pour un même article.
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

  update orders set total_amount = v_total where id = v_order_id;

  return v_order_id;
end;
$$;

-- Signature de fonction inchangée (toujours `jsonb` pour p_items, seule sa
-- forme interne change) : les droits déjà accordés (0004/0006) restent valides.

-- `get_order_receipt_items` : renvoie désormais un seul `variant_label` agrégé
-- ("Taille: XL, Couleur: Rouge") par article plutôt qu'un couple
-- variant_name/variant_value unique — la forme du retour change, donc DROP +
-- CREATE plutôt que CREATE OR REPLACE (même contrainte que 0006 pour
-- get_order_receipt : Postgres n'autorise pas de modifier la forme d'un type
-- RETURNS TABLE existant par un simple remplacement).
drop function if exists public.get_order_receipt_items(uuid);

create function public.get_order_receipt_items(p_order_id uuid)
returns table (
  product_title text,
  variant_label text,
  quantity integer,
  unit_price numeric
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.title,
    nullif(string_agg(pv.name || ': ' || pv.value, ', ' order by pv.name), ''),
    oi.quantity,
    oi.unit_price
  from order_items oi
  join products p on p.id = oi.product_id
  left join order_item_variants oiv on oiv.order_item_id = oi.id
  left join product_variants pv on pv.id = oiv.variant_id
  where oi.order_id = p_order_id
  group by oi.id, p.title, oi.quantity, oi.unit_price;
$$;

grant execute on function public.get_order_receipt_items(uuid) to anon, authenticated;
