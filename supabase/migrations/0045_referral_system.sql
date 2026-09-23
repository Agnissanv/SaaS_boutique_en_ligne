-- ============================================================================
-- Système de parrainage vendeur (23/09/2026, demande d'Isaac : "je veux
-- ajouter un système de parrainage"). Décisions tranchées avec lui avant
-- d'écrire quoi que ce soit (AskUserQuestion) :
--
-- - Déclencheur de la récompense : le FILLEUL passe sur un plan PAYANT
--   (Business ou Pro) — jamais la simple création de boutique, ni une
--   première commande, ni le mois d'essai Pro gratuit offert à toute
--   nouvelle boutique (`start_free_subscription`, migration 0029 : ni un
--   paiement, ni une action volontaire du vendeur, donc jamais un déclencheur
--   valable). Voir src/lib/referrals.ts (`maybeGrantReferralReward`),
--   appelée UNIQUEMENT depuis les deux endroits qui représentent un vrai
--   paiement confirmé : l'assignation manuelle admin
--   (admin/abonnements/actions.ts) et le webhook CinetPay ACCEPTED
--   (api/cinetpay/webhook/route.ts) — jamais depuis `applyPlanToShop`
--   elle-même (fonction commune déjà critique) ni depuis la rétrogradation
--   automatique Starter de subscription-lifecycle.ts.
-- - Récompense : prolonge de 30 jours le plan ACTUEL de la boutique si elle
--   est déjà payante, sinon la fait passer de Starter à Pro pour 30 jours —
--   appliquée aux DEUX boutiques (filleul et parrain) au moment du paiement.
-- - Visibilité admin : oui, dès cette première version (page /admin/parrainages).
--
-- Le code de parrainage réutilise le SLUG de boutique existant plutôt qu'une
-- colonne dédiée : un identifiant public, déjà unique, déjà mémorisable,
-- déjà affiché dans l'URL de chaque boutique — inventer un second code
-- aurait dupliqué ce que `shops.slug` fait déjà.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) profiles.referred_by_code — capturé à l'inscription (avant même que le
--    nouveau vendeur ait créé sa boutique, cf. saveShop() dans
--    dashboard/boutique/actions.ts qui le consomme plus tard). Même
--    mécanisme que `display_name` (migration 0009) : transmis via
--    `options.data` à signUp(), disponible immédiatement dans
--    `auth.users.raw_user_meta_data` dès l'insert qui déclenche
--    handle_new_user() ci-dessous. Pour Google (qui ne transmet aucune
--    métadonnée arbitraire), voir `?ref=` sur /auth/callback/route.ts,
--    même principe que `?portal=customer` pour ce provider.
-- ----------------------------------------------------------------------------
alter table profiles add column if not exists referred_by_code text;

-- handle_new_user() : reprend le corps exact de la migration 0030 (dernière
-- version), en ajoutant uniquement la capture de `referred_by_code`. Aucune
-- validation d'existence du slug ici : ce trigger tourne avant qu'aucune
-- boutique n'existe pour ce nouvel utilisateur — la validation réelle
-- (slug existant, boutique active, pas d'auto-parrainage) a lieu plus tard,
-- dans create_referral() ci-dessous, appelée au moment de la création de
-- boutique.
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
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(new.email, '@', 1),
    new.phone,
    'Utilisateur'
  );
  v_avatar_url text := nullif(trim(coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture'
  )), '');
  v_role text := case when v_requested_role = 'customer' then 'customer' else 'vendor' end;
  v_phone text := nullif(trim(new.raw_user_meta_data->>'phone'), '');
  v_referred_by_code text := nullif(trim(new.raw_user_meta_data->>'referred_by_code'), '');
begin
  begin
    insert into public.profiles (id, display_name, phone, role, avatar_url, referred_by_code)
    values (new.id, v_display_name, v_phone, v_role, v_avatar_url, v_referred_by_code)
    on conflict (id) do nothing;
  exception when unique_violation then
    insert into public.profiles (id, display_name, role, avatar_url, referred_by_code)
    values (new.id, v_display_name, v_role, v_avatar_url, v_referred_by_code)
    on conflict (id) do nothing;
  end;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2) Table `referrals` — une ligne par filleul, jamais deux (contrainte
--    unique sur `referred_shop_id`) : chaque boutique n'a qu'un seul parrain
--    possible, pour toujours — anti-fraude le plus simple qui empêche déjà
--    un vendeur de se faire "reparrainer" plusieurs fois avec des liens
--    différents.
-- ----------------------------------------------------------------------------
create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_shop_id uuid not null references shops (id) on delete cascade,
  referred_shop_id uuid not null unique references shops (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Posé par `maybeGrantReferralReward` (src/lib/referrals.ts) au moment où
  -- le filleul passe payant — reste `null` tant qu'il n'a pas encore payé.
  -- Sert aussi de verrou anti-double-récompense (update ... where
  -- rewarded_at is null) si le webhook CinetPay est rejoué ou qu'un admin
  -- clique deux fois.
  rewarded_at timestamptz,
  reward_days integer not null default 30,
  constraint referrals_no_self_referral check (referrer_shop_id <> referred_shop_id)
);

create index if not exists referrals_referrer_shop_id_idx on referrals (referrer_shop_id);

alter table referrals enable row level security;

-- Lecture : propriétaire ou collaborateur de la boutique PARRAIN (c'est sa
-- propre page "Parrainage" qui liste ses filleuls) — même schéma que
-- `shop_page_views` (migration 0043) : owner_read + collaborator_read,
-- plus un accès admin pour /admin/parrainages.
create policy "referrals_owner_read" on referrals for select using (
  exists (select 1 from shops where shops.id = referrals.referrer_shop_id and shops.owner_id = auth.uid())
);
create policy "referrals_collaborator_read" on referrals for select using (
  is_shop_collaborator(referrer_shop_id)
);
create policy "referrals_admin_read" on referrals for select using (is_admin());

-- Aucune policy d'insertion/mise à jour cliente : `create_referral()`
-- (écriture) et `maybeGrantReferralReward` côté application (mise à jour de
-- `rewarded_at`, via le client admin/service-role — déjà couvert par
-- `subscriptions_admin_write`-style, ici pas besoin de policy dédiée côté
-- update puisque les deux appelants réels sont soit admin (is_admin() déjà
-- vrai pour toute table) soit le webhook en service role qui contourne RLS.

-- `create_referral` : seul chemin d'écriture pour une nouvelle ligne.
-- Appelée depuis saveShop() (dashboard/boutique/actions.ts) juste après la
-- création d'une boutique, avec le `referred_by_code` lu sur le profil du
-- nouvel utilisateur. `security definer` nécessaire : l'appelant (nouveau
-- vendeur) n'a par défaut aucun droit d'écriture sur une ligne référençant
-- la boutique de quelqu'un d'autre (referrer_shop_id).
--
-- Volontairement permissive en cas d'échec (slug inconnu, auto-parrainage,
-- boutique déjà parrainée) : ne lève AUCUNE exception dans ces cas, retourne
-- simplement sans rien faire — un code de parrainage invalide/périmé ne doit
-- jamais empêcher la création de boutique (même principe que
-- `start_free_subscription`, appelé juste avant, dans le même bloc
-- "non bloquant" de saveShop()).
create or replace function public.create_referral(p_referred_shop_id uuid, p_referrer_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_shop_id uuid;
begin
  if p_referrer_slug is null or trim(p_referrer_slug) = '' then
    return;
  end if;

  -- Le filleul doit être la boutique qui vient d'être créée par l'appelant.
  if not exists (
    select 1 from shops where id = p_referred_shop_id and owner_id = auth.uid()
  ) then
    return;
  end if;

  select id into v_referrer_shop_id
  from shops
  where slug = trim(p_referrer_slug) and status = 'active';

  if v_referrer_shop_id is null or v_referrer_shop_id = p_referred_shop_id then
    return;
  end if;

  insert into referrals (referrer_shop_id, referred_shop_id)
  values (v_referrer_shop_id, p_referred_shop_id)
  on conflict (referred_shop_id) do nothing;
end;
$$;

grant execute on function public.create_referral(uuid, text) to authenticated;
