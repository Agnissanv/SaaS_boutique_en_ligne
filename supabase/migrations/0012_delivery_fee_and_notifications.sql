-- ============================================================================
-- Frais de livraison affichés + email client optionnel (14/09/2026)
--
-- Suite à l'analyse comparative avec Jumia/gros concurrents demandée par
-- Isaac : deux manques identifiés comme bloquant la confiance du client au
-- moment décisif du checkout.
--
-- 1. Frais de livraison : jusqu'ici totalement absents du schéma. Le client
--    ne découvrait le coût de la livraison qu'après coup, via le vendeur.
--    Choix : un frais FIXE par boutique (`shops.delivery_fee`, configurable
--    par le vendeur dans son profil boutique, optionnel — null = "à
--    confirmer avec le vendeur"), pas un calcul par zone/distance (aucune
--    donnée de zone de livraison n'existe dans le projet, et ce serait
--    disproportionné pour un petit vendeur qui livre lui-même/via un
--    livreur informel). Le frais est FIGÉ sur la commande au moment de sa
--    création (`orders.delivery_fee`), pour ne jamais changer rétroactivement
--    si le vendeur modifie son tarif après coup — même logique que
--    `unit_price` déjà figé par article dans `order_items`.
--
-- 2. Email client optionnel : nécessaire pour permettre un email automatique
--    de mise à jour de statut (voir actions.ts côté dashboard commandes) —
--    le seul canal réellement automatique et gratuit disponible aujourd'hui
--    (SMS payant, API WhatsApp Business non branchée). Champ facultatif :
--    beaucoup de clients WhatsApp/Instagram n'ont pas d'email sous la main,
--    donc jamais bloquant pour passer commande.
-- ============================================================================

alter table shops add column if not exists delivery_fee numeric(12, 2)
  check (delivery_fee is null or delivery_fee >= 0);

alter table orders add column if not exists delivery_fee numeric(12, 2) not null default 0;
alter table orders add column if not exists customer_email text;

-- `create_order` : ajoute `p_customer_email` (nouveau paramètre optionnel en
-- fin de liste, compatible avec les appels existants) et intègre le frais de
-- livraison de la boutique — lu côté serveur depuis `shops.delivery_fee`,
-- jamais transmis par le client, pour qu'il ne puisse pas être falsifié.
create or replace function public.create_order(
  p_shop_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_payment_method text,
  p_items jsonb, -- [{ "product_id": uuid, "variant_ids": [uuid, ...] (une par groupe), "quantity": int }, ...]
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

  -- Vérifie que la boutique existe et est active, et récupère son frais de
  -- livraison au passage (0 si non configuré par le vendeur).
  select coalesce(delivery_fee, 0) into v_delivery_fee
    from shops
    where id = p_shop_id and status = 'active';

  if not found then
    raise exception 'Boutique introuvable ou inactive';
  end if;

  insert into orders (
    shop_id, customer_name, customer_phone, customer_email, delivery_address,
    payment_method, total_amount, status, delivery_lat, delivery_lng, delivery_fee
  )
  values (
    p_shop_id, trim(p_customer_name), trim(p_customer_phone),
    nullif(trim(coalesce(p_customer_email, '')), ''), nullif(trim(p_delivery_address), ''),
    p_payment_method, 0, 'pending', p_delivery_lat, p_delivery_lng, v_delivery_fee
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

  v_total := v_total + v_delivery_fee;

  update orders set total_amount = v_total where id = v_order_id;

  return v_order_id;
end;
$$;

-- Nouvelle identité de fonction (paramètre supplémentaire) : re-accorder
-- l'exécution comme pour toutes les RPC publiques.
grant execute on function public.create_order(
  uuid, text, text, text, text, jsonb, double precision, double precision, text
) to anon, authenticated;

-- `get_order_receipt` : ajoute `customer_email` et `delivery_fee` pour que la
-- page de confirmation affiche le détail (sous-total produits + livraison).
-- Forme du retour modifiée -> DROP + CREATE (même contrainte que 0006/0010).
drop function if exists public.get_order_receipt(uuid);

create function public.get_order_receipt(p_order_id uuid)
returns table (
  id uuid,
  customer_name text,
  customer_phone text,
  customer_email text,
  delivery_address text,
  delivery_lat double precision,
  delivery_lng double precision,
  delivery_fee numeric,
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
  select o.id, o.customer_name, o.customer_phone, o.customer_email, o.delivery_address,
         o.delivery_lat, o.delivery_lng, o.delivery_fee, o.status,
         o.payment_method, o.total_amount, o.created_at, s.name, s.slug
  from orders o
  join shops s on s.id = o.shop_id
  where o.id = p_order_id;
$$;

grant execute on function public.get_order_receipt(uuid) to anon, authenticated;
