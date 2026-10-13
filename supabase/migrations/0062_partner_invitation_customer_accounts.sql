-- ============================================================================
-- Programme partenaire : acceptation de l'invitation avec un compte CLIENT
-- (13/10/2026, suite au premier essai d'Isaac).
--
-- 0061 n'acceptait qu'un compte `role = 'vendor'`. Trop strict : `role` n'est
-- qu'une étiquette posée à l'inscription (voir `resolveHomePath`,
-- src/lib/auth-constants.ts) — une partenaire qui s'est d'abord inscrite
-- comme cliente pour acheter peut quand même créer sa boutique, rien dans
-- l'accès au tableau de bord ne dépend de cette étiquette. Seuls les comptes
-- d'équipe (admin, commercial) restent refusés, avec un message qui dit quoi
-- faire.
--
-- Reprend le corps de 0061 à l'identique, seule la vérification du rôle
-- change.
-- ============================================================================

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
  v_role text;
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

  select role into v_role from profiles where id = v_uid;
  if v_role in ('admin', 'commercial') then
    raise exception 'Ce compte appartient à l''équipe KEVA. Déconnecte-toi : la partenaire doit utiliser son propre compte.';
  end if;
  if v_role is null or v_role not in ('vendor', 'customer') then
    raise exception 'Compte introuvable. Reconnecte-toi puis réessaie.';
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
