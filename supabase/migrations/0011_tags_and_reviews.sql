-- ============================================================================
-- Tags produits + avis clients — demandé par Isaac le 13/09/2026 pour
-- rapprocher la fiche produit et le formulaire vendeur des standards des
-- concurrents (Jumia etc.), fonctionnalités avant le design visuel (qui
-- reste volontairement reporté à plus tard, cf. sa consigne explicite).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tags produits (cahier des charges §3.1.A.3 : "Catégorie / Tags" — seule la
-- catégorie existait jusqu'ici). Un simple tableau de texte suffit pour le
-- volume attendu (petits vendeurs, quelques mots-clés par produit) : pas
-- besoin d'une table de jointure séparée pour l'instant.
-- ----------------------------------------------------------------------------
alter table products add column if not exists tags text[] not null default '{}';

create index if not exists products_tags_idx on products using gin (tags);

-- ----------------------------------------------------------------------------
-- Avis clients (choisi explicitement par Isaac : "non modifiable par le
-- vendeur"). Les clients qui achètent n'ont pas de compte (pas d'auth.uid()),
-- donc un avis est rattaché à une commande réelle plutôt qu'à un profil :
-- seule preuve d'achat disponible sans authentification, même logique que
-- get_order_receipt (0004) qui utilise déjà l'id de commande, non devinable,
-- comme jeton d'accès "invité".
--
-- Limite assumée pour le MVP : rien n'empêche techniquement de laisser un
-- avis juste après avoir commandé, avant d'avoir reçu le produit (pas de
-- vérification du statut "livrée", pas de mécanisme de relance après
-- livraison — ça demanderait un système de notification client, WhatsApp/SMS
-- ou email, qui n'existe pas encore). Le lien de confirmation de commande
-- reste valable indéfiniment : rien n'empêche le client d'y revenir plus
-- tard, une fois le produit reçu — voir le texte ajouté sur cette page.
-- ----------------------------------------------------------------------------
create table if not exists product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  order_id uuid references orders (id) on delete set null,
  customer_name text not null,
  rating integer not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  unique (order_id, product_id)
);

create index if not exists product_reviews_product_id_idx on product_reviews (product_id);

alter table product_reviews enable row level security;

-- Lecture publique des avis des produits actifs (même règle que
-- product_variants_public_read en 0001).
create policy "product_reviews_public_read" on product_reviews for select using (
  exists (
    select 1 from products
    join shops on shops.id = products.shop_id
    where products.id = product_reviews.product_id and products.is_active and shops.status = 'active'
  )
);

-- Aucune policy insert/update/delete, y compris pour le vendeur : l'écriture
-- passe exclusivement par submit_product_review ci-dessous (security
-- definer), qui vérifie que la commande contient bien le produit avant
-- d'insérer. C'est ce qui garantit concrètement "avis non modifiable par le
-- vendeur" — il n'a tout simplement aucun droit d'écriture sur cette table.
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
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'La note doit être comprise entre 1 et 5';
  end if;

  -- La commande doit exister et contenir le produit visé : seule preuve
  -- d'achat disponible sans compte client. Le nom affiché vient de la
  -- commande elle-même (pas d'un champ libre envoyé par le client), pour
  -- éviter qu'un avis usurpe un autre nom.
  select o.customer_name into v_customer_name
    from orders o
    join order_items oi on oi.order_id = o.id
    where o.id = p_order_id and oi.product_id = p_product_id
    limit 1;

  if v_customer_name is null then
    raise exception 'Cette commande ne contient pas ce produit';
  end if;

  -- Upsert plutôt qu'un rejet en cas de doublon : le client peut revenir
  -- corriger son avis pour ce produit sur cette commande.
  insert into product_reviews (product_id, order_id, customer_name, rating, comment)
  values (p_product_id, p_order_id, v_customer_name, p_rating, nullif(trim(coalesce(p_comment, '')), ''))
  on conflict (order_id, product_id)
  do update set rating = excluded.rating, comment = excluded.comment, created_at = now();
end;
$$;

grant execute on function public.submit_product_review(uuid, uuid, integer, text) to anon, authenticated;

-- `get_order_receipt_items` : ajoute `product_id` (nécessaire pour proposer
-- le formulaire d'avis par produit sur la page de confirmation de commande).
-- Forme du retour modifiée -> DROP + CREATE (même contrainte qu'en 0006/0010).
drop function if exists public.get_order_receipt_items(uuid);

create function public.get_order_receipt_items(p_order_id uuid)
returns table (
  product_id uuid,
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
    p.id,
    p.title,
    nullif(string_agg(pv.name || ': ' || pv.value, ', ' order by pv.name), ''),
    oi.quantity,
    oi.unit_price
  from order_items oi
  join products p on p.id = oi.product_id
  left join order_item_variants oiv on oiv.order_item_id = oi.id
  left join product_variants pv on pv.id = oiv.variant_id
  where oi.order_id = p_order_id
  group by oi.id, p.id, p.title, oi.quantity, oi.unit_price;
$$;

grant execute on function public.get_order_receipt_items(uuid) to anon, authenticated;
