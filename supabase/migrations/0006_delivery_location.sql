-- ============================================================================
-- Position GPS de livraison (optionnelle, en plus de l'adresse texte qui
-- devient obligatoire côté formulaire) — demande d'Isaac du 13/09/2026 :
-- beaucoup d'adresses à Abidjan n'ont pas de repère écrit fiable, un pin GPS
-- partagé par le client donne au vendeur un lien Google Maps exact sans
-- passer par l'API Google Maps (pas de clé, pas de facturation) :
-- https://www.google.com/maps?q=<lat>,<lng> fonctionne sans authentification.
-- ============================================================================

alter table orders add column if not exists delivery_lat double precision;
alter table orders add column if not exists delivery_lng double precision;

-- CREATE OR REPLACE FUNCTION autorise l'ajout de paramètres en fin de liste
-- tant qu'ils ont une valeur par défaut : les appels existants (sans lat/lng)
-- restent valides.
create or replace function public.create_order(
  p_shop_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_payment_method text,
  p_items jsonb, -- [{ "product_id": uuid, "variant_id": uuid|null, "quantity": int }, ...]
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
  v_quantity integer;
  v_unit_price numeric(12, 2);
  v_total numeric(12, 2) := 0;
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

    if v_item ? 'variant_id' and v_item->>'variant_id' is not null and v_item->>'variant_id' <> '' then
      select * into v_variant
        from product_variants
        where id = (v_item->>'variant_id')::uuid and product_id = v_product.id;

      if not found then
        raise exception 'Variante invalide pour "%"', v_product.title;
      end if;

      v_unit_price := v_unit_price + coalesce(v_variant.extra_price, 0);
    end if;

    update products
      set stock = stock - v_quantity, updated_at = now()
      where id = v_product.id;

    insert into order_items (order_id, product_id, variant_id, quantity, unit_price)
    values (
      v_order_id,
      v_product.id,
      case when v_item ? 'variant_id' and v_item->>'variant_id' <> ''
        then (v_item->>'variant_id')::uuid
        else null
      end,
      v_quantity,
      v_unit_price
    );

    v_total := v_total + v_unit_price * v_quantity;
  end loop;

  update orders set total_amount = v_total where id = v_order_id;

  return v_order_id;
end;
$$;

-- Nouvelle identité de fonction (paramètres supplémentaires) : re-accorder
-- l'exécution à anon/authenticated comme pour toutes les RPC publiques.
grant execute on function public.create_order(
  uuid, text, text, text, text, jsonb, double precision, double precision
) to anon, authenticated;

-- get_order_receipt renvoie désormais aussi la position, pour le lien
-- "Voir sur la carte" côté page de confirmation/reçu client.
drop function if exists public.get_order_receipt(uuid);

create function public.get_order_receipt(p_order_id uuid)
returns table (
  id uuid,
  customer_name text,
  customer_phone text,
  delivery_address text,
  delivery_lat double precision,
  delivery_lng double precision,
  status text,
  payment_method text,
  total_amount numeric,
  created_at timestamptz,
  shop_name text,
  shop_slug text
)
language sql
security definer
set search_path = public
stable
as $$
  select o.id, o.customer_name, o.customer_phone, o.delivery_address,
         o.delivery_lat, o.delivery_lng, o.status,
         o.payment_method, o.total_amount, o.created_at, s.name, s.slug
  from orders o
  join shops s on s.id = o.shop_id
  where o.id = p_order_id;
$$;

grant execute on function public.get_order_receipt(uuid) to anon, authenticated;
