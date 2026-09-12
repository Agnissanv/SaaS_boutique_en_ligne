-- ============================================================================
-- Migration initiale — SaaS boutique en ligne (Côte d'Ivoire)
-- Entités du cahier des charges §6 : User, Shop, Product, ProductVariant,
-- Order, OrderItem, Payment, Subscription, SubscriptionPlan, TransactionLog,
-- Notification.
--
-- À appliquer via : npx supabase db push  (ou coller dans le SQL Editor
-- du dashboard Supabase).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Profiles (User) — étend auth.users géré par Supabase Auth
-- ----------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text unique,
  display_name text,
  avatar_url text,
  role text not null default 'vendor' check (role in ('vendor', 'admin')),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Shops
-- ----------------------------------------------------------------------------
create table if not exists shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text check (char_length(description) <= 300),
  category text not null check (
    category in ('mode', 'beaute', 'electronique', 'maison', 'alimentation', 'autre')
  ),
  cover_url text,
  logo_url text,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists shops_owner_id_idx on shops (owner_id);

-- ----------------------------------------------------------------------------
-- Products
-- ----------------------------------------------------------------------------
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  slug text not null,
  title text not null,
  description text,
  price numeric(12, 2) not null check (price >= 0),
  compare_at_price numeric(12, 2) check (compare_at_price is null or compare_at_price >= 0),
  stock integer not null default 0 check (stock >= 0),
  category text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (shop_id, slug)
);

create index if not exists products_shop_id_idx on products (shop_id);

-- Photos produit (1 à 6, cf. cahier des charges)
create table if not exists product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  url text not null,
  position integer not null default 0
);

create index if not exists product_images_product_id_idx on product_images (product_id);

-- Variantes simples (Taille, Couleur...)
create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  name text not null, -- ex: "Taille"
  value text not null, -- ex: "M"
  stock integer not null default 0 check (stock >= 0),
  extra_price numeric(12, 2) not null default 0
);

create index if not exists product_variants_product_id_idx on product_variants (product_id);

-- ----------------------------------------------------------------------------
-- Orders
-- ----------------------------------------------------------------------------
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  customer_name text not null,
  customer_phone text not null,
  delivery_address text,
  status text not null default 'pending' check (
    status in ('pending', 'paid', 'preparing', 'delivered', 'cancelled')
  ),
  payment_method text not null check (payment_method in ('mobile_money', 'cash_on_delivery')),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_shop_id_idx on orders (shop_id);
create index if not exists orders_status_idx on orders (status);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  product_id uuid not null references products (id),
  variant_id uuid references product_variants (id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0)
);

create index if not exists order_items_order_id_idx on order_items (order_id);

-- ----------------------------------------------------------------------------
-- Payments (commandes ET abonnements)
-- ----------------------------------------------------------------------------
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references shops (id) on delete set null,
  order_id uuid references orders (id) on delete set null,
  subscription_id uuid, -- FK ajoutée après création de `subscriptions`
  provider text not null default 'cinetpay',
  provider_transaction_id text,
  amount numeric(12, 2),
  currency text not null default 'XOF',
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payments_shop_id_idx on payments (shop_id);
create index if not exists payments_order_id_idx on payments (order_id);

-- ----------------------------------------------------------------------------
-- Subscriptions
-- ----------------------------------------------------------------------------
create table if not exists subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, -- 'free' | 'essentiel' | 'pro'
  name text not null,
  price numeric(12, 2) not null default 0,
  duration_days integer not null default 30,
  features jsonb not null default '{}'::jsonb
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  plan_id uuid not null references subscription_plans (id),
  status text not null default 'active' check (status in ('active', 'expired', 'grace_period')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists subscriptions_shop_id_idx on subscriptions (shop_id);

alter table payments
  add constraint payments_subscription_id_fkey
  foreign key (subscription_id) references subscriptions (id) on delete set null;

-- ----------------------------------------------------------------------------
-- Transaction logs (audit — paiements, changements d'abonnement)
-- ----------------------------------------------------------------------------
create table if not exists transaction_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles (id) on delete set null,
  shop_id uuid references shops (id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Notifications
-- ----------------------------------------------------------------------------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  title text not null,
  body text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_profile_id_idx on notifications (profile_id);

-- ============================================================================
-- Row Level Security
--
-- Principe : lecture publique (anon) sur boutiques/produits actifs pour les
-- pages boutique. Écriture réservée au propriétaire (vendeur) authentifié.
-- Les commandes publiques (clients sans compte) et les webhooks de paiement
-- passent par des Route Handlers utilisant la service role key (bypass RLS),
-- jamais par un insert direct depuis le navigateur.
-- ============================================================================

alter table profiles enable row level security;
alter table shops enable row level security;
alter table products enable row level security;
alter table product_images enable row level security;
alter table product_variants enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payments enable row level security;
alter table subscription_plans enable row level security;
alter table subscriptions enable row level security;
alter table transaction_logs enable row level security;
alter table notifications enable row level security;

-- Profiles : chacun lit/modifie son propre profil
create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

-- Shops : lecture publique des boutiques actives, gestion par le propriétaire
create policy "shops_public_read_active" on shops for select using (status = 'active');
create policy "shops_owner_all" on shops for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Products : lecture publique si produit actif ET boutique active
create policy "products_public_read_active" on products for select using (
  is_active = true
  and exists (select 1 from shops where shops.id = products.shop_id and shops.status = 'active')
);
create policy "products_owner_all" on products for all using (
  exists (select 1 from shops where shops.id = products.shop_id and shops.owner_id = auth.uid())
) with check (
  exists (select 1 from shops where shops.id = products.shop_id and shops.owner_id = auth.uid())
);

-- Product images / variants : mêmes règles que products, via le produit parent
create policy "product_images_public_read" on product_images for select using (
  exists (
    select 1 from products
    join shops on shops.id = products.shop_id
    where products.id = product_images.product_id and products.is_active and shops.status = 'active'
  )
);
create policy "product_images_owner_all" on product_images for all using (
  exists (
    select 1 from products
    join shops on shops.id = products.shop_id
    where products.id = product_images.product_id and shops.owner_id = auth.uid()
  )
);

create policy "product_variants_public_read" on product_variants for select using (
  exists (
    select 1 from products
    join shops on shops.id = products.shop_id
    where products.id = product_variants.product_id and products.is_active and shops.status = 'active'
  )
);
create policy "product_variants_owner_all" on product_variants for all using (
  exists (
    select 1 from products
    join shops on shops.id = products.shop_id
    where products.id = product_variants.product_id and shops.owner_id = auth.uid()
  )
);

-- Orders / order_items : uniquement le vendeur propriétaire de la boutique
-- (les clients passent commande via un Route Handler avec service role key)
create policy "orders_owner_read" on orders for select using (
  exists (select 1 from shops where shops.id = orders.shop_id and shops.owner_id = auth.uid())
);
create policy "orders_owner_update" on orders for update using (
  exists (select 1 from shops where shops.id = orders.shop_id and shops.owner_id = auth.uid())
);

create policy "order_items_owner_read" on order_items for select using (
  exists (
    select 1 from orders
    join shops on shops.id = orders.shop_id
    where orders.id = order_items.order_id and shops.owner_id = auth.uid()
  )
);

-- Payments : lecture par le vendeur propriétaire uniquement (écriture via service role)
create policy "payments_owner_read" on payments for select using (
  shop_id is not null
  and exists (select 1 from shops where shops.id = payments.shop_id and shops.owner_id = auth.uid())
);

-- Subscription plans : lecture publique (page tarifs)
create policy "subscription_plans_public_read" on subscription_plans for select using (true);

-- Subscriptions : lecture par le vendeur propriétaire
create policy "subscriptions_owner_read" on subscriptions for select using (
  exists (select 1 from shops where shops.id = subscriptions.shop_id and shops.owner_id = auth.uid())
);

-- Transaction logs : pas d'accès direct côté client (admin via service role uniquement)
-- Aucune policy select/insert créée volontairement -> RLS bloque tout accès non service-role.

-- Notifications : chacun lit/modifie ses propres notifications
create policy "notifications_owner_read" on notifications for select using (auth.uid() = profile_id);
create policy "notifications_owner_update" on notifications for update using (auth.uid() = profile_id);

-- ----------------------------------------------------------------------------
-- Plans d'abonnement de départ (cf. cahier des charges §3.1.A.7)
-- ----------------------------------------------------------------------------
insert into subscription_plans (code, name, price, duration_days, features)
values
  ('free', 'Gratuit limité', 0, 30, '{"max_products": 10}'::jsonb),
  ('essentiel', 'Essentiel', 3000, 30, '{"max_products": 100}'::jsonb),
  ('pro', 'Pro', 7000, 30, '{"max_products": null}'::jsonb)
on conflict (code) do nothing;
