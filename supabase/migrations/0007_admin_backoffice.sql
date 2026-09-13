-- ============================================================================
-- Back-office admin (cahier des charges §3.1.C) : dashboard global, gestion
-- des vendeurs (activation/suspension/recherche), gestion des abonnements,
-- logs des transactions, support basique.
--
-- Item de Priorité 1 resté totalement ouvert jusqu'ici (page /admin
-- placeholder) — construit maintenant pendant que CinetPay reste bloqué
-- côté validation de compte, sur demande d'Isaac du 13/09/2026 de ne pas
-- attendre pour continuer à avancer.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- is_admin() : fonction utilitaire pour les policies RLS ci-dessous.
--
-- `security definer` est nécessaire pour éviter une auto-référence RLS sur
-- `profiles` : sans ça, une policy sur `profiles` qui interroge `profiles`
-- ré-applique RLS à cette sous-requête (récursion/complexité inutile). En
-- passant par une fonction security definer, la sous-requête interne
-- s'exécute avec les droits du propriétaire de la fonction, hors RLS.
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- ----------------------------------------------------------------------------
-- Support basique (§3.1.C.5) : note libre par boutique, éditable par l'admin
-- uniquement. Pas de vrai système de tickets pour l'instant — cf.
-- decisions-techniques.md pour la justification de cette simplification.
-- ----------------------------------------------------------------------------
alter table shops add column if not exists admin_notes text;

-- ----------------------------------------------------------------------------
-- Policies admin : lecture large + actions de gestion, réservées au rôle
-- 'admin' (profiles.role). Les policies vendeur/public existantes restent
-- inchangées, celles-ci s'y ajoutent (RLS = OR entre policies).
-- ----------------------------------------------------------------------------

-- Vendeurs : recherche/consultation de toutes les boutiques (pas seulement
-- actives) et de tous les profils, activation/suspension.
create policy "shops_admin_read" on shops for select using (is_admin());
create policy "shops_admin_update" on shops for update using (is_admin()) with check (is_admin());
create policy "profiles_admin_read" on profiles for select using (is_admin());

-- Dashboard global : CA plateforme (toutes commandes, toutes boutiques).
create policy "orders_admin_read" on orders for select using (is_admin());

-- Historique des paiements, toutes boutiques confondues.
create policy "payments_admin_read" on payments for select using (is_admin());

-- Gestion des abonnements : lecture + changement de plan manuel (le paiement
-- réel via CinetPay n'est pas encore branché, voir decisions-techniques.md).
create policy "subscriptions_admin_read" on subscriptions for select using (is_admin());
create policy "subscriptions_admin_write" on subscriptions for all using (is_admin()) with check (is_admin());

-- Logs des transactions : lecture + écriture réservées à l'admin (les
-- actions admin elles-mêmes y sont journalisées depuis les Server Actions).
create policy "transaction_logs_admin_read" on transaction_logs for select using (is_admin());
create policy "transaction_logs_admin_insert" on transaction_logs for insert with check (is_admin());

-- ----------------------------------------------------------------------------
-- start_free_subscription : crée l'abonnement "Gratuit limité" par défaut à
-- la création d'une boutique, pour que "nombre d'abonnements actifs" (stat
-- admin) et la page "Gestion des abonnements" aient une donnée dès le
-- départ plutôt qu'un vide permanent tant que CinetPay n'est pas branché.
-- `security definer` + vérification de propriété manuelle (plutôt qu'une
-- policy INSERT sur `subscriptions`) : même pattern que `create_order` /
-- `increment_shop_view`, cohérent avec le reste du schéma RPC.
-- ----------------------------------------------------------------------------
create or replace function public.start_free_subscription(p_shop_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_free_plan_id uuid;
begin
  if not exists (
    select 1 from shops where id = p_shop_id and owner_id = auth.uid()
  ) then
    raise exception 'Boutique introuvable ou non autorisée';
  end if;

  if exists (select 1 from subscriptions where shop_id = p_shop_id) then
    return; -- déjà un abonnement, ne rien faire (évite un doublon au re-save)
  end if;

  select id into v_free_plan_id from subscription_plans where code = 'free';

  insert into subscriptions (shop_id, plan_id, status, started_at, expires_at)
  values (p_shop_id, v_free_plan_id, 'active', now(), now() + interval '30 days');
end;
$$;

grant execute on function public.start_free_subscription(uuid) to authenticated;
