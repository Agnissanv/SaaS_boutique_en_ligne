-- ============================================================================
-- Essai gratuit "Pro" d'un mois pour chaque nouvelle boutique (21/09/2026) —
-- demande explicite d'Isaac avant le lancement V1. CinetPay n'est pas encore
-- opérationnel côté abonnements (compte Aurora bloqué en validation, voir
-- decisions-techniques.md) : en attendant, l'encaissement se ferait à la
-- main — mais Isaac préfère offrir le premier mois avec TOUTES les
-- fonctionnalités Pro à chaque nouveau vendeur plutôt que de le démarrer sur
-- Starter (2 produits, pas de stock/variantes). Isaac compte sur le fait que
-- CinetPay sera opérationnel avant la fin de ce premier mois pour prendre le
-- relais du paiement réel.
--
-- `start_free_subscription` (0007_admin_backoffice.sql, plans renommés en
-- 0016_subscription_plans_v2.sql) sélectionnait jusqu'ici le plan `starter`
-- — changé pour `pro`. Nom de la fonction et point d'appel inchangés
-- (`boutique/actions.ts`, juste après la création d'une boutique) : renommer
-- la RPC pour un gain cosmétique nul aurait cassé cette référence sans
-- bénéfice réel.
--
-- `is_trial` (nouvelle colonne) distingue ce mois offert d'un vrai paiement
-- (assignation manuelle admin ou futur paiement CinetPay confirmé) : sans
-- ça, vendeur et admin verraient juste "Pro" sans savoir qu'il s'agit d'un
-- cadeau de lancement temporaire — risque de confusion à l'expiration
-- (blocage normal du plan expiré, cf. src/lib/subscription.ts), qui aurait pu
-- ressembler à un bug plutôt qu'à la fin de l'essai. `applyPlanToShop` (donc
-- l'assignation admin ET le webhook CinetPay) met systématiquement
-- `is_trial = false` : toute assignation réelle de plan efface le statut
-- d'essai, qu'elle soit gratuite (ex: Starter réassigné à la main) ou payante.
-- ============================================================================

alter table subscriptions add column if not exists is_trial boolean not null default false;

create or replace function public.start_free_subscription(p_shop_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pro_plan_id uuid;
begin
  if not exists (
    select 1 from shops where id = p_shop_id and owner_id = auth.uid()
  ) then
    raise exception 'Boutique introuvable ou non autorisée';
  end if;

  if exists (select 1 from subscriptions where shop_id = p_shop_id) then
    return; -- déjà un abonnement, ne rien faire (évite un doublon au re-save)
  end if;

  select id into v_pro_plan_id from subscription_plans where code = 'pro';

  insert into subscriptions (shop_id, plan_id, status, started_at, expires_at, is_trial)
  values (p_shop_id, v_pro_plan_id, 'active', now(), now() + interval '30 days', true);
end;
$$;

grant execute on function public.start_free_subscription(uuid) to authenticated;
