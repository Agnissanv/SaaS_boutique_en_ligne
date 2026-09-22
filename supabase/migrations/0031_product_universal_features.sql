-- ============================================================================
-- Fonctionnalités "universelles" de la fiche produit — demandé par Isaac le
-- 22/09/2026 après avoir montré des captures du flux "Ajouter un produit" de
-- Jumia Vendor Center (ancien vendeur Jumia). Décision explicite d'Isaac
-- (discussion avant code, cf. sa consigne) : on prend d'abord le lot
-- "universel" (s'applique à tous les produits, quelle que soit la
-- catégorie), pas le système de spécifications par catégorie (qui suppose
-- des sous-catégories, pas encore créées — chantier séparé, futur).
--
-- Décision explicite n°2 : on garde le modèle de variantes actuel
-- (name/value "groupe", cf. product_variants en 0001) plutôt que de passer à
-- de vraies combinaisons SKU (Taille+Couleur comme une seule ligne stockée).
-- Rappel du choix volontaire documenté en 0010 : pas de stock par
-- combinaison exacte, pour rester simple — cette migration ne touche donc ni
-- le schéma d'order_items, ni order_item_variants. `create_order` EST bien
-- modifié plus bas (section prix promo daté), mais uniquement pour calculer
-- le bon montant à facturer — la structure des tables de commande ne change
-- pas.
--
-- Contenu de ce lot (4 points confirmés par Isaac, "oui") :
--   1. products.highlights : "Points forts" — liste à puces, même pattern
--      que products.tags (0011).
--   2. SKU / code-barres : au niveau de chaque valeur de variante
--      (product_variants), et en option au niveau du produit lui-même pour
--      les produits sans variante.
--   3. Prix promo daté ("prix soldé", distinct du "prix barré" permanent
--      compare_at_price qui existe déjà) : sale_price + fenêtre
--      sale_starts_at / sale_ends_at. Le calcul du prix "effectif" (actif ou
--      non selon la date du jour) se fait côté application (src/lib/products.ts),
--      pas en base — pas besoin d'un job cron pour "activer" la promo.
--   4. La validation d'image (résolution 500x500 à 2000x2000px, taille max
--      2 Mo, fond blanc recommandé, pas de filigrane) est purement côté
--      formulaire (product-form.tsx) : rien à faire ici, aucune colonne
--      n'est nécessaire pour ça.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Points forts (highlights) — mêmes raisons que products.tags en 0011 :
-- un tableau de texte suffit pour le volume attendu, pas de table séparée.
-- ----------------------------------------------------------------------------
alter table products add column if not exists highlights text[] not null default '{}';

create index if not exists products_highlights_idx on products using gin (highlights);

-- ----------------------------------------------------------------------------
-- 2. SKU / code-barres.
--
-- Au niveau produit : optionnel, pensé pour un produit SANS variante (dans
-- ce cas product_variants est vide, il faut bien un endroit où renseigner un
-- SKU/code-barres si le vendeur en a un).
--
-- Au niveau variante (product_variants) : optionnel aussi, une valeur de
-- variante donnée (ex: "Taille" / "M") peut avoir son propre SKU/code-barres
-- — c'est le niveau le plus fin que permette le modèle actuel (pas de vraie
-- combinaison, cf. rappel plus haut).
--
-- Pas de contrainte unique globale : un vendeur peut très bien laisser ces
-- champs vides (aucune obligation), et rien ne garantit l'unicité d'un SKU
-- entre boutiques différentes (pas pertinent ici, chaque boutique gère son
-- propre catalogue).
-- ----------------------------------------------------------------------------
alter table products add column if not exists sku text;
alter table products add column if not exists barcode text;

alter table product_variants add column if not exists sku text;
alter table product_variants add column if not exists barcode text;

-- ----------------------------------------------------------------------------
-- 3. Prix promo daté, distinct du "prix barré" permanent (compare_at_price).
--
-- compare_at_price reste un prix de référence permanent (ex: prix "normal"
-- affiché barré en continu). sale_price est un prix promotionnel actif
-- uniquement pendant [sale_starts_at, sale_ends_at] — les deux mécanismes
-- sont indépendants et peuvent coexister (ex: un produit avec un prix barré
-- permanent ET une promo ponctuelle en plus).
--
-- sale_starts_at / sale_ends_at nullable ensemble : un vendeur peut définir
-- seulement une date de fin (promo active dès maintenant jusqu'à telle
-- date), ou les deux. On exige qu'une fin soit postérieure à un début
-- lorsque les deux sont renseignés, sans forcer les deux à être remplis.
-- ----------------------------------------------------------------------------
alter table products add column if not exists sale_price numeric(12, 2)
  check (sale_price is null or sale_price >= 0);
alter table products add column if not exists sale_starts_at timestamptz;
alter table products add column if not exists sale_ends_at timestamptz;

alter table products add constraint products_sale_window_order
  check (
    sale_starts_at is null or sale_ends_at is null or sale_ends_at > sale_starts_at
  );

-- ----------------------------------------------------------------------------
-- create_order : doit facturer le prix EFFECTIF (soldé si la promo est
-- active maintenant, sinon le prix normal), pas juste `products.price` en
-- dur comme avant cette migration. Sans ce changement, un client verrait un
-- prix soldé sur la fiche produit (calcul côté application, voir
-- `getEffectivePrice` dans src/lib/products.ts) mais se ferait facturer le
-- plein tarif à la commande — la RPC reste la seule source de vérité pour le
-- montant réellement débité (jamais le prix envoyé par le client), donc
-- c'est ici, et seulement ici côté base, que la fenêtre de promo doit être
-- évaluée. Logique de fenêtre dupliquée en SQL (`isSaleActive` côté
-- TypeScript) : les deux doivent rester en phase si cette règle change un
-- jour.
--
-- Signature INCHANGÉE depuis 0023_promo_codes.sql (10 paramètres, mêmes
-- types/défauts) — corps repris à l'identique depuis 0030, seul le calcul de
-- `v_unit_price` change (prix produit -> prix effectif), avant l'ajout du
-- `extra_price` éventuel d'une variante.
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
