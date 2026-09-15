-- ============================================================================
-- Refonte des plans d'abonnement (15/09/2026) — spec finale fournie par Isaac.
--
-- Nouveaux plans : Starter (gratuit, 2 produits), Business (2 500 FCFA/mois,
-- 30 produits), Pro (7 000 FCFA/mois, illimité). Renommage EN PLACE des 3
-- lignes existantes (update par ancien `code`, pas delete+insert) : les
-- boutiques déjà abonnées (`subscriptions.plan_id`) basculent automatiquement
-- sur les nouvelles conditions sans étape de migration séparée — projet
-- encore sans vendeur réel à ce stade (voir decisions-techniques.md), donc
-- aucun risque à changer les conditions d'un plan existant sous les pieds de
-- quelqu'un.
--
-- `features` (jsonb) accueille maintenant tous les feature flags par plan,
-- pas seulement `max_products` :
-- - max_products (int | null = illimité)
-- - can_manage_stock, can_use_variants : Isaac a confirmé vouloir retirer ces
--   deux fonctions au plan Starter alors qu'elles étaient jusqu'ici
--   universelles (voir product-form.tsx / produits/actions.ts) — décision
--   explicite, pas une supposition.
-- - can_use_promo_codes, can_customize_branding ('none'|'basic'|'complete'),
--   can_remove_branding, can_export_stats, can_multi_user, max_collaborators,
--   has_order_notifications, has_advanced_stock_alerts : correspondent 1:1 à
--   la spec d'Isaac. Aucune de ces fonctionnalités n'existe encore dans le
--   code à ce stade (codes promo, multi-utilisateurs, export, personnalisation
--   logo/couleurs, badge de branding KEVA) — les flags sont posés en base
--   maintenant, câblés au fil des prochains chantiers (voir
--   decisions-techniques.md).
-- ============================================================================

update subscription_plans
set
  code = 'starter',
  name = 'Starter',
  price = 0,
  duration_days = 30,
  features = '{
    "max_products": 2,
    "can_manage_stock": false,
    "can_use_variants": false,
    "can_use_promo_codes": false,
    "can_customize_branding": "none",
    "can_remove_branding": false,
    "can_export_stats": false,
    "can_multi_user": false,
    "max_collaborators": 0,
    "has_order_notifications": false,
    "has_advanced_stock_alerts": false
  }'::jsonb
where code = 'free';

update subscription_plans
set
  code = 'business',
  name = 'Business',
  price = 2500,
  duration_days = 30,
  features = '{
    "max_products": 30,
    "can_manage_stock": true,
    "can_use_variants": true,
    "can_use_promo_codes": false,
    "can_customize_branding": "basic",
    "can_remove_branding": false,
    "can_export_stats": false,
    "can_multi_user": false,
    "max_collaborators": 0,
    "has_order_notifications": true,
    "has_advanced_stock_alerts": false
  }'::jsonb
where code = 'essentiel';

update subscription_plans
set
  code = 'pro',
  name = 'Pro',
  price = 7000,
  duration_days = 30,
  features = '{
    "max_products": null,
    "can_manage_stock": true,
    "can_use_variants": true,
    "can_use_promo_codes": true,
    "can_customize_branding": "complete",
    "can_remove_branding": true,
    "can_export_stats": true,
    "can_multi_user": true,
    "max_collaborators": 2,
    "has_order_notifications": true,
    "has_advanced_stock_alerts": true
  }'::jsonb
where code = 'pro';

-- Filet de sécurité : si jamais aucune des 3 lignes attendues n'existait déjà
-- (base fraîchement créée sans être passée par 0001_init.sql avec les anciens
-- codes), on les insère directement avec les nouvelles valeurs.
insert into subscription_plans (code, name, price, duration_days, features)
select 'starter', 'Starter', 0, 30, '{
    "max_products": 2, "can_manage_stock": false, "can_use_variants": false,
    "can_use_promo_codes": false, "can_customize_branding": "none",
    "can_remove_branding": false, "can_export_stats": false,
    "can_multi_user": false, "max_collaborators": 0,
    "has_order_notifications": false, "has_advanced_stock_alerts": false
  }'::jsonb
where not exists (select 1 from subscription_plans where code = 'starter');

insert into subscription_plans (code, name, price, duration_days, features)
select 'business', 'Business', 2500, 30, '{
    "max_products": 30, "can_manage_stock": true, "can_use_variants": true,
    "can_use_promo_codes": false, "can_customize_branding": "basic",
    "can_remove_branding": false, "can_export_stats": false,
    "can_multi_user": false, "max_collaborators": 0,
    "has_order_notifications": true, "has_advanced_stock_alerts": false
  }'::jsonb
where not exists (select 1 from subscription_plans where code = 'business');

insert into subscription_plans (code, name, price, duration_days, features)
select 'pro', 'Pro', 7000, 30, '{
    "max_products": null, "can_manage_stock": true, "can_use_variants": true,
    "can_use_promo_codes": true, "can_customize_branding": "complete",
    "can_remove_branding": true, "can_export_stats": true,
    "can_multi_user": true, "max_collaborators": 2,
    "has_order_notifications": true, "has_advanced_stock_alerts": true
  }'::jsonb
where not exists (select 1 from subscription_plans where code = 'pro');

-- `start_free_subscription` (0007_admin_backoffice.sql) sélectionne le plan
-- gratuit par `code = 'free'` — mis à jour pour suivre le renommage, sinon
-- plus aucune nouvelle boutique n'obtiendrait d'abonnement de départ. Corps
-- de la fonction repris à l'identique (même vérification de propriété via
-- `auth.uid()`, même garde anti-doublon) — seul `code = 'free'` devient
-- `code = 'starter'`.
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

  select id into v_free_plan_id from subscription_plans where code = 'starter';

  insert into subscriptions (shop_id, plan_id, status, started_at, expires_at)
  values (p_shop_id, v_free_plan_id, 'active', now(), now() + interval '30 days');
end;
$$;

grant execute on function public.start_free_subscription(uuid) to authenticated;
