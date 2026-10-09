-- ============================================================================
-- Protection de `shops.is_verified` et `shops.plan_rank` contre l'auto-attribution
-- — 09/10/2026 (audit de sécurité).
--
-- Problème : la politique `shops_owner_all` (0001) autorise le propriétaire à
-- modifier toutes les colonnes de sa boutique. Les triggers existants protègent
-- `status` (0008), `view_count` (0036) et le branding (0037), mais ni le badge
-- « Boutique vérifiée » (`is_verified`) ni le rang de boost marketplace
-- (`plan_rank`), ajoutés en 0042. Un vendeur pouvait donc, avec sa propre
-- session et un simple appel PostgREST, se donner le badge et le meilleur
-- classement sans payer.
--
-- Correctif : un trigger BEFORE UPDATE qui refuse tout changement de ces deux
-- colonnes quand la requête vient d'un client (`authenticated` / `anon`) et que
-- l'auteur n'est pas admin.
--
-- Pourquoi `current_user` plutôt que `is_admin()` seul : la synchronisation
-- légitime se fait dans `sync_shop_plan_denormalization()` (0042), une fonction
-- `security definer` déclenchée par un changement d'abonnement. Pendant son
-- UPDATE, `current_user` est le propriétaire de la fonction (postgres), alors
-- que `auth.uid()` est encore celui du vendeur — un test sur `is_admin()` la
-- bloquerait. Ce trigger est donc volontairement SECURITY INVOKER (sans
-- `security definer`) : dans un trigger `security definer`, `current_user`
-- vaudrait toujours le propriétaire et ne distinguerait plus rien.
--
-- Cas couverts :
--   - client vendeur / anonyme (`authenticated`, `anon`)  -> refusé sauf admin
--   - `sync_shop_plan_denormalization` (security definer)  -> autorisé
--   - service role (webhook, crons, `service_role`)        -> autorisé
-- ============================================================================

create or replace function public.prevent_shop_trust_columns_tampering()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (
    new.is_verified is distinct from old.is_verified
    or new.plan_rank is distinct from old.plan_rank
  )
  and current_user in ('authenticated', 'anon')
  and not public.is_admin()
  then
    raise exception 'Modification du badge vérifié ou du rang non autorisée';
  end if;

  return new;
end;
$$;

drop trigger if exists shops_prevent_trust_columns_tampering on shops;
create trigger shops_prevent_trust_columns_tampering
  before update on shops
  for each row
  execute function public.prevent_shop_trust_columns_tampering();
