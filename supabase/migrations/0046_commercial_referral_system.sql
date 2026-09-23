-- ============================================================================
-- Parrainage COMMERCIAL (23/09/2026, suite du système de parrainage vendeur
-- de la migration 0045). Demande d'Isaac : en plus du parrainage entre
-- vendeurs, il veut pouvoir embaucher des commerciaux dont le métier est de
-- démarcher des vendeurs pour qu'ils s'abonnent — rémunérés en argent réel,
-- PAS en jours d'abonnement offerts comme le parrainage vendeur (deux
-- mécaniques de récompense volontairement distinctes, jamais mélangées).
--
-- Décisions tranchées avec Isaac avant d'écrire quoi que ce soit
-- (AskUserQuestion) :
-- - Commission : 500 FCFA à CHAQUE paiement d'un abonnement Business (2500
--   FCFA), 1500 FCFA à CHAQUE paiement d'un abonnement Pro (7000 FCFA) — pas
--   une seule fois, mais à CHAQUE renouvellement tant que le vendeur recruté
--   reste payant. C'est un vrai ledger d'événements, pas une ligne unique
--   par vendeur (voir `commercial_commission_events` plus bas).
-- - Accès : chaque commercial a son propre compte (comme un vendeur), créé
--   PAR Isaac depuis /admin/commerciaux (pas d'auto-inscription publique —
--   rôle sensible, argent réel en jeu). Voir handle_new_user() plus bas :
--   'commercial' n'est PAS ajouté à la liste blanche de rôles auto-
--   assignables via les métadonnées de signUp() public (même prudence que
--   la migration 0008 pour 'admin') — seule une action admin peut créer un
--   compte avec ce rôle.
--
-- Canal de suivi séparé de celui du parrainage vendeur (delibéré, pas une
-- négligence) : un vendeur recruté par un commercial arrive via
-- `?agent=<code>` (capturé dans `profiles.referred_by_agent_code`), jamais
-- via le `?ref=<slug>` du parrainage vendeur (`profiles.referred_by_code`,
-- migration 0045) — deux espaces de codes totalement indépendants (un slug
-- de boutique existante vs un code de commercial), donc aucun risque de
-- collision ni d'ambiguïté sur laquelle des deux mécaniques s'applique.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Correctif découvert en testant bout en bout ce fichier sur une base
--    Postgres locale (rejeu complet 0001→0046, voir decisions-techniques.md) :
--    `prevent_role_self_escalation()` (migration 0008) bloque TOUTE
--    modification de `profiles.role` tant que `public.is_admin()` est faux —
--    or `is_admin()` s'appuie sur `auth.uid()`, qui est NULL pour une
--    connexion via la clé service role (`createServiceRoleClient()`,
--    utilisée par `createCommercial` ci-dessous car `auth.admin.createUser()`
--    l'exige). Résultat : même l'action admin légitime qui vient de créer un
--    compte commercial se faisait bloquer en essayant de lui donner ce rôle.
--
--    Corrigé en autorisant AUSSI le changement quand `auth.role() =
--    'service_role'` — le rôle JWT que Supabase attribue précisément aux
--    requêtes authentifiées avec la clé service role. Ne rouvre PAS la faille
--    que 0008 a fermée : cette faille concernait un VENDEUR modifiant son
--    propre rôle depuis son propre navigateur (session `authenticated`
--    normale, jamais `service_role` — cette clé n'est ni exposée ni
--    accessible côté client). La clé service role n'est utilisée que dans du
--    code serveur de confiance déjà gardé par ailleurs (webhook CinetPay,
--    actions admin déjà vérifiées par `requireAdmin()`).
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and not public.is_admin()
     and auth.role() is distinct from 'service_role' then
    raise exception 'Modification du rôle non autorisée';
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 1) Rôle 'commercial' + code de suivi + capture à l'inscription.
-- ----------------------------------------------------------------------------
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('vendor', 'admin', 'customer', 'commercial'));

-- Code de suivi du commercial (son propre "slug", généré par Isaac à la
-- création du compte — voir admin/commerciaux/actions.ts) : sert à
-- construire son lien `{site}/inscription?agent=<code>`, exactement comme
-- `shops.slug` sert de code de parrainage vendeur.
alter table profiles add column if not exists commercial_code text unique;

-- Capturé à l'inscription du VENDEUR recruté (pas du commercial) — même
-- mécanisme que `referred_by_code` (migration 0045) : transmis via
-- `options.data.referred_by_agent_code` à signUp(), ou `?agent=` sur
-- /auth/callback pour Google.
alter table profiles add column if not exists referred_by_agent_code text;

-- handle_new_user() : reprend le corps de la migration 0045 (dernière
-- version), en ajoutant uniquement la capture de `referred_by_agent_code`.
-- Le rôle 'commercial' n'apparaît PAS ici : impossible à auto-assigner via
-- signUp() public, seule la création par un admin (auth.admin.createUser
-- côté service role, puis update direct de `profiles.role`) peut le poser —
-- ce trigger continue de retomber sur 'vendor' par défaut pour ce compte
-- avant que l'action admin ne corrige le rôle juste après.
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
  v_referred_by_agent_code text := nullif(trim(new.raw_user_meta_data->>'referred_by_agent_code'), '');
begin
  begin
    insert into public.profiles
      (id, display_name, phone, role, avatar_url, referred_by_code, referred_by_agent_code)
    values
      (new.id, v_display_name, v_phone, v_role, v_avatar_url, v_referred_by_code, v_referred_by_agent_code)
    on conflict (id) do nothing;
  exception when unique_violation then
    insert into public.profiles
      (id, display_name, role, avatar_url, referred_by_code, referred_by_agent_code)
    values
      (new.id, v_display_name, v_role, v_avatar_url, v_referred_by_code, v_referred_by_agent_code)
    on conflict (id) do nothing;
  end;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2) `commercial_referrals` — quel commercial a recruté quelle boutique.
--    Une ligne par boutique recrutée, jamais deux (même anti-fraude que
--    `referrals` côté vendeur, migration 0045).
-- ----------------------------------------------------------------------------
create table if not exists commercial_referrals (
  id uuid primary key default gen_random_uuid(),
  commercial_id uuid not null references profiles (id) on delete cascade,
  referred_shop_id uuid not null unique references shops (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists commercial_referrals_commercial_id_idx on commercial_referrals (commercial_id);

alter table commercial_referrals enable row level security;

-- Lecture : le commercial voit ses propres recrutements ; l'admin voit tout
-- (page /admin/commerciaux). Pas de lecture "propriétaire de boutique" ici
-- (contrairement à `referrals`) : un vendeur n'a pas besoin de savoir quel
-- commercial l'a recruté, seul Isaac et le commercial concerné.
create policy "commercial_referrals_self_read" on commercial_referrals for select using (
  commercial_id = auth.uid()
);
create policy "commercial_referrals_admin_all" on commercial_referrals for all using (
  is_admin()
) with check (is_admin());

-- `create_commercial_referral` : seul chemin d'écriture, même principe que
-- `create_referral` (migration 0045) — permissive en cas d'échec (code
-- inconnu, compte non-commercial, boutique déjà recrutée), ne bloque jamais
-- la création de boutique.
create or replace function public.create_commercial_referral(p_referred_shop_id uuid, p_agent_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_commercial_id uuid;
begin
  if p_agent_code is null or trim(p_agent_code) = '' then
    return;
  end if;

  if not exists (
    select 1 from shops where id = p_referred_shop_id and owner_id = auth.uid()
  ) then
    return;
  end if;

  select id into v_commercial_id
  from profiles
  where commercial_code = trim(p_agent_code) and role = 'commercial';

  if v_commercial_id is null then
    return;
  end if;

  insert into commercial_referrals (commercial_id, referred_shop_id)
  values (v_commercial_id, p_referred_shop_id)
  on conflict (referred_shop_id) do nothing;
end;
$$;

grant execute on function public.create_commercial_referral(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 3) `commercial_commission_events` — ledger des commissions dues, UNE ligne
--    par paiement réel (pas par vendeur) : "à chaque abonnement de 2500/7000
--    FCFA" (mots d'Isaac) veut dire à chaque renouvellement, pas juste le
--    premier. Chaque ligne est créée par `maybeCreditCommercialCommission`
--    (src/lib/commercial-referrals.ts), appelée aux DEUX mêmes endroits que
--    `maybeGrantReferralReward` (paiement admin manuel, webhook CinetPay
--    ACCEPTED) — jamais un versement automatique réel : Isaac paie ses
--    commerciaux lui-même en dehors de l'app (Wave/mobile money), `paid_at`
--    n'est qu'un pointage manuel une fois qu'il l'a fait.
-- ----------------------------------------------------------------------------
create table if not exists commercial_commission_events (
  id uuid primary key default gen_random_uuid(),
  commercial_id uuid not null references profiles (id) on delete cascade,
  referred_shop_id uuid not null references shops (id) on delete cascade,
  plan_code text not null,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists commercial_commission_events_commercial_id_idx
  on commercial_commission_events (commercial_id);

alter table commercial_commission_events enable row level security;

-- Lecture : le commercial voit ses propres commissions (montant, statut
-- payé/dû) ; l'admin gère tout (y compris marquer comme payé — voir
-- markCommercialPaid côté admin). Écriture cliente : uniquement l'admin
-- (l'insertion normale se fait via le client service role du webhook
-- CinetPay, qui contourne RLS de toute façon — cette policy ne couvre que
-- le cas de l'assignation manuelle admin, qui utilise le client
-- authentifié de l'admin, pas le service role).
create policy "commercial_commission_events_self_read" on commercial_commission_events for select using (
  commercial_id = auth.uid()
);
create policy "commercial_commission_events_admin_all" on commercial_commission_events for all using (
  is_admin()
) with check (is_admin());
