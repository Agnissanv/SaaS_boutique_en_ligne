-- ============================================================================
-- Programme Partenaire Influenceur (13/10/2026).
--
-- Contrat signé par Isaac avec une créatrice de contenu : elle fait connaître
-- KEVA à sa communauté via ses liens / son code ; en échange, boutique Pro
-- offerte pendant le partenariat et commission MENSUELLE sur chaque
-- abonnement payant qu'elle amène (1 000 F/mois par Business, 2 000 F/mois
-- par Pro, tant que l'abonnement reste payé). Construit pour PLUSIEURS
-- partenaires, chacun avec ses propres montants.
--
-- Décisions prises avec Isaac avant d'écrire quoi que ce soit :
-- - Distinct des commerciaux (migration 0046) : autres montants, un code en
--   plus du lien, une mémoire de 30 jours côté navigateur, des statistiques
--   de clics par réseau social. "Partenaire" n'est PAS un rôle de
--   `profiles` : c'est une ligne `partners` rattachée à un compte vendeur
--   normal (un seul compte : sa boutique + son espace partenaire).
-- - Invitation : Isaac crée la ligne (libellé, montants, date de début) et
--   envoie un lien à usage unique valable 7 jours ; la partenaire choisit
--   elle-même son nom affiché, son code et son numéro de paiement
--   (`accept_partner_invitation`), modifiables ensuite
--   (`update_partner_settings`). Les montants et les dates restent à l'admin.
-- - Un ancien code continue de fonctionner après un changement
--   (`partner_codes` garde tout l'historique) : ses anciennes vidéos lui
--   rapportent toujours.
-- - Elle ne voit que des CHIFFRES (jamais le nom des boutiques) : aucune
--   lecture directe de `partner_referrals` ni `partner_clicks` pour elle,
--   tout passe par `get_partner_stats`.
-- - Une boutique n'est jamais rattachée à deux personnes (partenaire,
--   commercial ou parrain vendeur) : le premier rattachement l'emporte.
-- - Fin du partenariat : `ends_on` (préavis de 7 jours). Rien n'est
--   supprimé : l'espace reste consultable, mais plus aucun clic, rattachement
--   ni commission n'est enregistré (`partner_is_active`).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Tables
-- ----------------------------------------------------------------------------
create table if not exists partners (
  id uuid primary key default gen_random_uuid(),
  -- Nom interne pour Isaac (« Djandjou »), jamais montré au public.
  label text not null check (char_length(trim(label)) between 1 and 80),
  -- Compte de la partenaire, posé à l'acceptation de l'invitation.
  profile_id uuid unique references profiles (id) on delete set null,
  -- Choisis par la partenaire elle-même.
  display_name text check (display_name is null or char_length(trim(display_name)) between 1 and 60),
  code text unique check (code is null or code ~ '^[A-Z0-9]{3,20}$'),
  payout_method text check (
    payout_method is null or payout_method in ('wave', 'orange_money', 'mtn_money', 'moov_money')
  ),
  payout_phone text check (payout_phone is null or payout_phone ~ '^\+?[0-9 ]{8,20}$'),
  -- Mis à jour à chaque changement de numéro : affiché à l'admin avant de
  -- payer (protège d'un compte piraté qui détournerait les paiements).
  payout_updated_at timestamptz,
  -- Fixés par l'admin uniquement.
  business_commission integer not null check (business_commission >= 0),
  pro_commission integer not null check (pro_commission >= 0),
  starts_on date not null default current_date,
  ends_on date,
  -- Boutique qui reçoit le Pro offert (la sienne).
  gifted_shop_id uuid unique references shops (id) on delete set null,
  -- Invitation : jeton à usage unique, effacé à l'acceptation.
  invite_token text unique,
  invite_expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Historique de TOUS les codes d'un partenaire (le code actuel compris) : un
-- code n'est jamais réattribué à quelqu'un d'autre, et un ancien code
-- continue de mener à son propriétaire.
create table if not exists partner_codes (
  code text primary key check (code ~ '^[A-Z0-9]{3,20}$'),
  partner_id uuid not null references partners (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists partner_codes_partner_id_idx on partner_codes (partner_id);

-- Une ligne par visiteur arrivé par un lien partenaire (le premier passage
-- seulement, voir la route /p/[code]).
create table if not exists partner_clicks (
  id bigint generated always as identity primary key,
  partner_id uuid not null references partners (id) on delete cascade,
  source text not null check (source in ('general', 'tiktok', 'instagram', 'facebook')),
  created_at timestamptz not null default now()
);
create index if not exists partner_clicks_partner_created_idx on partner_clicks (partner_id, created_at);

-- Quelle boutique a été amenée par quel partenaire, et par quel canal.
create table if not exists partner_referrals (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners (id) on delete cascade,
  referred_shop_id uuid not null unique references shops (id) on delete cascade,
  source text not null check (
    source in ('general', 'tiktok', 'instagram', 'facebook', 'code', 'admin')
  ),
  created_at timestamptz not null default now()
);
create index if not exists partner_referrals_partner_id_idx on partner_referrals (partner_id);

-- Une ligne par MOIS d'abonnement payé par une boutique rattachée : un
-- paiement de 3 mois donne 3 lignes (mois M, M+1, M+2), conformément au
-- contrat (« X F / mois tant que l'abonnement reste actif »).
create table if not exists partner_commission_events (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners (id) on delete cascade,
  referred_shop_id uuid references shops (id) on delete set null,
  plan_code text not null,
  amount integer not null check (amount > 0),
  period_month date not null check (extract(day from period_month) = 1),
  payment_id uuid references payments (id) on delete set null,
  month_index smallint not null default 0 check (month_index >= 0),
  created_at timestamptz not null default now()
);
create index if not exists partner_commission_events_partner_month_idx
  on partner_commission_events (partner_id, period_month);
-- Webhook Nyole rejoué : jamais deux fois la même commission pour un même
-- paiement (même verrou que la migration 0050 côté commerciaux).
create unique index if not exists partner_commission_events_payment_month_key
  on partner_commission_events (payment_id, month_index)
  where payment_id is not null;

-- Versements faits par Isaac (Wave / Mobile Money, en dehors de l'app).
-- Plusieurs versements possibles pour un même mois (complément si une
-- commission arrive après coup) : reste dû = commissions - versements.
create table if not exists partner_payouts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners (id) on delete cascade,
  period_month date not null check (extract(day from period_month) = 1),
  amount integer not null check (amount > 0),
  reference text check (reference is null or char_length(reference) <= 120),
  paid_at timestamptz not null default now(),
  paid_by uuid references profiles (id) on delete set null
);
create index if not exists partner_payouts_partner_month_idx on partner_payouts (partner_id, period_month);

-- ----------------------------------------------------------------------------
-- 2) Sécurité (RLS) : l'admin voit et gère tout ; la partenaire lit sa
--    propre fiche, ses codes, ses commissions et ses versements. Aucune
--    écriture directe pour elle : tout passe par les fonctions plus bas.
-- ----------------------------------------------------------------------------
alter table partners enable row level security;
alter table partner_codes enable row level security;
alter table partner_clicks enable row level security;
alter table partner_referrals enable row level security;
alter table partner_commission_events enable row level security;
alter table partner_payouts enable row level security;

drop policy if exists "partners_admin_all" on partners;
create policy "partners_admin_all" on partners for all using (is_admin()) with check (is_admin());
drop policy if exists "partners_self_read" on partners;
create policy "partners_self_read" on partners for select using (profile_id = auth.uid());

drop policy if exists "partner_codes_admin_all" on partner_codes;
create policy "partner_codes_admin_all" on partner_codes for all using (is_admin()) with check (is_admin());
drop policy if exists "partner_codes_self_read" on partner_codes;
create policy "partner_codes_self_read" on partner_codes for select using (
  exists (select 1 from partners p where p.id = partner_codes.partner_id and p.profile_id = auth.uid())
);

drop policy if exists "partner_clicks_admin_all" on partner_clicks;
create policy "partner_clicks_admin_all" on partner_clicks for all using (is_admin()) with check (is_admin());

drop policy if exists "partner_referrals_admin_all" on partner_referrals;
create policy "partner_referrals_admin_all" on partner_referrals for all using (is_admin()) with check (is_admin());

drop policy if exists "partner_commission_events_admin_all" on partner_commission_events;
create policy "partner_commission_events_admin_all" on partner_commission_events for all
  using (is_admin()) with check (is_admin());
drop policy if exists "partner_commission_events_self_read" on partner_commission_events;
create policy "partner_commission_events_self_read" on partner_commission_events for select using (
  exists (select 1 from partners p where p.id = partner_commission_events.partner_id and p.profile_id = auth.uid())
);

drop policy if exists "partner_payouts_admin_all" on partner_payouts;
create policy "partner_payouts_admin_all" on partner_payouts for all using (is_admin()) with check (is_admin());
drop policy if exists "partner_payouts_self_read" on partner_payouts;
create policy "partner_payouts_self_read" on partner_payouts for select using (
  exists (select 1 from partners p where p.id = partner_payouts.partner_id and p.profile_id = auth.uid())
);

-- ----------------------------------------------------------------------------
-- 3) Fonctions
-- ----------------------------------------------------------------------------

-- Partenariat en cours : invitation acceptée, commencé, pas encore terminé.
create or replace function public.partner_is_active(p_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from partners
    where id = p_partner_id
      and profile_id is not null
      and accepted_at is not null
      and starts_on <= current_date
      and (ends_on is null or ends_on > current_date)
  );
$$;

-- Normalise un code saisi (« djandjou » -> « DJANDJOU ») ; null si le format
-- est invalide.
create or replace function public.normalize_partner_code(p_code text)
returns text
language sql
immutable
as $$
  select case
    when upper(trim(coalesce(p_code, ''))) ~ '^[A-Z0-9]{3,20}$' then upper(trim(p_code))
    else null
  end;
$$;

-- Page d'invitation : de quoi afficher « Invitation de KEVA pour X, tes
-- commissions seront de... » avant que la personne crée son compte.
create or replace function public.get_partner_invitation(p_token text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_partner partners;
begin
  if p_token is null or char_length(p_token) < 20 then
    return null;
  end if;
  select * into v_partner from partners where invite_token = p_token;
  if not found then
    return null;
  end if;
  return json_build_object(
    'label', v_partner.label,
    'business_commission', v_partner.business_commission,
    'pro_commission', v_partner.pro_commission,
    'starts_on', v_partner.starts_on,
    'expired', v_partner.invite_expires_at is null or v_partner.invite_expires_at < now()
  );
end;
$$;

-- Acceptation de l'invitation par la partenaire, connectée à SON compte.
create or replace function public.accept_partner_invitation(
  p_token text,
  p_display_name text,
  p_code text,
  p_payout_method text,
  p_payout_phone text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_partner partners;
  v_code text := public.normalize_partner_code(p_code);
  v_name text := nullif(trim(coalesce(p_display_name, '')), '');
  v_phone text := nullif(trim(coalesce(p_payout_phone, '')), '');
begin
  if v_uid is null then
    raise exception 'Connecte-toi pour accepter l''invitation.';
  end if;

  select * into v_partner from partners where invite_token = p_token for update;
  if not found then
    raise exception 'Cette invitation n''existe pas ou a déjà été utilisée.';
  end if;
  if v_partner.invite_expires_at is null or v_partner.invite_expires_at < now() then
    raise exception 'Cette invitation a expiré. Demande un nouveau lien à KEVA.';
  end if;
  if exists (select 1 from partners where profile_id = v_uid) then
    raise exception 'Ce compte est déjà partenaire KEVA.';
  end if;
  if not exists (select 1 from profiles where id = v_uid and role = 'vendor') then
    raise exception 'Utilise un compte vendeur KEVA pour devenir partenaire.';
  end if;
  if v_name is null or char_length(v_name) > 60 then
    raise exception 'Choisis un nom affiché (60 caractères au plus).';
  end if;
  if v_code is null then
    raise exception 'Ton code doit faire 3 à 20 lettres ou chiffres, sans espace.';
  end if;
  if exists (select 1 from partner_codes where code = v_code) then
    raise exception 'Ce code est déjà pris. Choisis-en un autre.';
  end if;
  if p_payout_method not in ('wave', 'orange_money', 'mtn_money', 'moov_money') then
    raise exception 'Choisis un moyen de paiement.';
  end if;
  if v_phone is null or v_phone !~ '^\+?[0-9 ]{8,20}$' then
    raise exception 'Numéro de paiement invalide.';
  end if;

  update partners set
    profile_id = v_uid,
    display_name = v_name,
    code = v_code,
    payout_method = p_payout_method,
    payout_phone = v_phone,
    payout_updated_at = now(),
    accepted_at = now(),
    invite_token = null,
    invite_expires_at = null,
    updated_at = now()
  where id = v_partner.id;

  insert into partner_codes (code, partner_id) values (v_code, v_partner.id);

  return v_partner.id;
end;
$$;

-- Réglages modifiables par la partenaire elle-même. Le code ne peut plus
-- changer une fois le partenariat terminé (espace figé) ; le nom et le
-- numéro de paiement, si (le dernier versement peut rester à faire).
create or replace function public.update_partner_settings(
  p_display_name text,
  p_code text,
  p_payout_method text,
  p_payout_phone text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner partners;
  v_code text := public.normalize_partner_code(p_code);
  v_name text := nullif(trim(coalesce(p_display_name, '')), '');
  v_phone text := nullif(trim(coalesce(p_payout_phone, '')), '');
  v_owner uuid;
begin
  select * into v_partner from partners where profile_id = auth.uid() for update;
  if not found then
    raise exception 'Aucun partenariat sur ce compte.';
  end if;
  if v_name is null or char_length(v_name) > 60 then
    raise exception 'Choisis un nom affiché (60 caractères au plus).';
  end if;
  if v_code is null then
    raise exception 'Ton code doit faire 3 à 20 lettres ou chiffres, sans espace.';
  end if;
  if p_payout_method not in ('wave', 'orange_money', 'mtn_money', 'moov_money') then
    raise exception 'Choisis un moyen de paiement.';
  end if;
  if v_phone is null or v_phone !~ '^\+?[0-9 ]{8,20}$' then
    raise exception 'Numéro de paiement invalide.';
  end if;

  if v_code is distinct from v_partner.code then
    if not public.partner_is_active(v_partner.id) then
      raise exception 'Ton partenariat est terminé : le code ne peut plus changer.';
    end if;
    select partner_id into v_owner from partner_codes where code = v_code;
    if v_owner is not null and v_owner <> v_partner.id then
      raise exception 'Ce code est déjà pris. Choisis-en un autre.';
    end if;
    if v_owner is null then
      insert into partner_codes (code, partner_id) values (v_code, v_partner.id);
    end if;
  end if;

  update partners set
    display_name = v_name,
    code = v_code,
    payout_method = p_payout_method,
    payout_phone = v_phone,
    payout_updated_at = case
      when payout_method is distinct from p_payout_method or payout_phone is distinct from v_phone
        then now()
      else payout_updated_at
    end,
    updated_at = now()
  where id = v_partner.id;
end;
$$;

-- Clic sur un lien partenaire. Appelée UNIQUEMENT par le serveur (route
-- /p/[code], clé service role, après limitation de débit) : jamais exposée
-- au navigateur, pour qu'on ne puisse pas gonfler les statistiques en
-- appelant la fonction en boucle. Renvoie le code ACTUEL du partenaire (un
-- ancien code mène au nouveau), ou null si le code est inconnu ou le
-- partenariat inactif.
create or replace function public.record_partner_click(p_code text, p_source text, p_count boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_id uuid;
  v_current_code text;
begin
  select p.id, p.code into v_partner_id, v_current_code
  from partner_codes c
  join partners p on p.id = c.partner_id
  where c.code = public.normalize_partner_code(p_code);

  if v_partner_id is null or not public.partner_is_active(v_partner_id) then
    return null;
  end if;

  if p_count then
    insert into partner_clicks (partner_id, source)
    values (
      v_partner_id,
      case when p_source in ('tiktok', 'instagram', 'facebook') then p_source else 'general' end
    );
  end if;

  return v_current_code;
end;
$$;

revoke execute on function public.record_partner_click(text, text, boolean) from public, anon, authenticated;
grant execute on function public.record_partner_click(text, text, boolean) to service_role;

-- Rattachement d'une boutique à un partenaire, par la propriétaire de la
-- boutique : à la création de boutique (lien mémorisé ou code saisi à
-- l'inscription), ou plus tard sur la page Abonnement, tant que la boutique
-- n'a jamais payé. Renvoie un statut lisible par l'application :
-- 'ok' | 'invalid_code' | 'inactive' | 'self' | 'already_attributed' |
-- 'already_paid' | 'not_owner'.
create or replace function public.create_partner_referral(p_shop_id uuid, p_code text, p_source text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner partners;
begin
  if not exists (select 1 from shops where id = p_shop_id and owner_id = auth.uid()) then
    return 'not_owner';
  end if;

  select p.* into v_partner
  from partner_codes c
  join partners p on p.id = c.partner_id
  where c.code = public.normalize_partner_code(p_code);

  if not found then
    return 'invalid_code';
  end if;
  if not public.partner_is_active(v_partner.id) then
    return 'inactive';
  end if;
  if v_partner.profile_id = auth.uid() then
    return 'self';
  end if;

  if exists (select 1 from partner_referrals where referred_shop_id = p_shop_id)
     or exists (select 1 from commercial_referrals where referred_shop_id = p_shop_id)
     or exists (select 1 from referrals where referred_shop_id = p_shop_id) then
    return 'already_attributed';
  end if;

  if exists (
       select 1 from payments
       where shop_id = p_shop_id and status = 'success' and order_id is null
     )
     or exists (
       select 1 from subscriptions s
       join subscription_plans sp on sp.id = s.plan_id
       where s.shop_id = p_shop_id and sp.code in ('business', 'pro') and s.is_trial = false
     ) then
    return 'already_paid';
  end if;

  insert into partner_referrals (partner_id, referred_shop_id, source)
  values (
    v_partner.id,
    p_shop_id,
    case when p_source in ('general', 'tiktok', 'instagram', 'facebook') then p_source else 'code' end
  );
  return 'ok';
end;
$$;

grant execute on function public.create_partner_referral(uuid, text, text) to authenticated;

-- Statistiques d'un mois (p_month = n'importe quel jour du mois voulu) :
-- pour la partenaire connectée, ou pour l'admin avec `p_partner_id`.
-- Uniquement des chiffres, jamais le nom des boutiques.
create or replace function public.get_partner_stats(p_month date, p_partner_id uuid default null)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_partner_id uuid;
  v_start date := date_trunc('month', coalesce(p_month, current_date))::date;
  v_end date := (date_trunc('month', coalesce(p_month, current_date)) + interval '1 month')::date;
begin
  if p_partner_id is not null then
    if not public.is_admin() then
      raise exception 'Accès refusé.';
    end if;
    v_partner_id := p_partner_id;
  else
    select id into v_partner_id from partners where profile_id = auth.uid();
    if v_partner_id is null then
      raise exception 'Aucun partenariat sur ce compte.';
    end if;
  end if;

  return json_build_object(
    'month', v_start,
    'clicks', (
      select coalesce(json_object_agg(source, n), '{}'::json)
      from (
        select source, count(*) as n from partner_clicks
        where partner_id = v_partner_id and created_at >= v_start and created_at < v_end
        group by source
      ) t
    ),
    'shops', (
      select coalesce(json_object_agg(source, n), '{}'::json)
      from (
        select source, count(*) as n from partner_referrals
        where partner_id = v_partner_id and created_at >= v_start and created_at < v_end
        group by source
      ) t
    ),
    'shops_total', (select count(*) from partner_referrals where partner_id = v_partner_id),
    'active', (
      select coalesce(json_object_agg(code, n), '{}'::json)
      from (
        select sp.code, count(*) as n
        from partner_referrals r
        join subscriptions s on s.shop_id = r.referred_shop_id
        join subscription_plans sp on sp.id = s.plan_id
        where r.partner_id = v_partner_id
          and sp.code in ('business', 'pro')
          and s.is_trial = false
          and s.expires_at > now()
        group by sp.code
      ) t
    ),
    'earned', (
      select coalesce(sum(amount), 0) from partner_commission_events
      where partner_id = v_partner_id and period_month = v_start
    )
  );
end;
$$;

grant execute on function public.get_partner_stats(date, uuid) to authenticated;
