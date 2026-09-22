-- ============================================================================
-- Verrouillage en base du palier de personnalisation de marque (22/09/2026,
-- suite de l'audit back-office admin). Signalé dans le rapport d'audit comme
-- décision à prendre plutôt que corrigé tout de suite ; Isaac a demandé
-- "qu'est-ce que tu proposes ?" — approche retenue ci-dessous.
--
-- Le problème : `shops_owner_all` (0001_init.sql) est `for all`, donc couvre
-- aussi `logo_url`/`accent_color`. Le blocage "logo réservé Business+,
-- couleur d'accent réservée Pro" (`canCustomizeBranding`, voir
-- boutique/actions.ts) n'existait QUE côté code applicatif — un vendeur
-- Starter pouvait, par un appel PostgREST direct, écrire son propre
-- `logo_url` en contournant complètement l'app.
--
-- Pourquoi pas un trigger "bloquer sauf admin" comme les autres points de
-- l'audit (0036) : ici il y a un cas légitime où un vendeur NON-admin doit
-- pouvoir écrire ces colonnes lui-même (juste conditionné par son plan), donc
-- il faut un trigger qui RESSORT la même règle métier, pas qui l'interdise
-- en bloc.
--
-- Le risque de duplication/dérive identifié dans le rapport d'audit est
-- réel si on recopie des VALEURS (ex: coder en dur "'business'/'pro' =
-- autorisé") dans le trigger : si Isaac change un jour les paliers dans
-- `subscription_plans.features`, le trigger et le code applicatif
-- pourraient diverger silencieusement. Solution : le trigger ne connaît
-- AUCUNE valeur de plan — il relit `can_customize_branding` directement
-- dans `subscription_plans.features` (le même jsonb, la même clé que lit
-- `parseFeatureFlags` côté TypeScript), donc une seule source de vérité
-- réellement partagée, pas une copie. Changer les paliers dans le jsonb
-- (ex: activer la personnalisation logo sur Starter) change le comportement
-- des deux côtés instantanément, sans toucher à cette migration.
--
-- Même critère de résolution de plan que `getShopSubscription`
-- (src/lib/subscription.ts) : abonnement le plus récent par `started_at`
-- (la contrainte `subscriptions_shop_id_key` de 0036 garantit maintenant une
-- seule ligne de toute façon, mais on reste explicite plutôt que de compter
-- dessus). Aucune boutique sans abonnement -> traité comme Starter
-- ('none'), même filet de sécurité que `DEFAULT_FEATURE_FLAGS` côté TS.
-- `cover_url` n'est PAS concerné : jamais gaté par plan côté app, donc pas
-- touché ici.
-- ============================================================================

create or replace function public.shop_branding_level(p_shop_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select sp.features ->> 'can_customize_branding'
      from subscriptions s
      join subscription_plans sp on sp.id = s.plan_id
      where s.shop_id = p_shop_id
      order by s.started_at desc
      limit 1
    ),
    'none'
  );
$$;

create or replace function public.prevent_branding_plan_bypass()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_level text;
begin
  if public.is_admin() then
    return new;
  end if;

  if new.logo_url is distinct from old.logo_url
    or new.accent_color is distinct from old.accent_color
  then
    v_level := public.shop_branding_level(new.id);

    if new.logo_url is distinct from old.logo_url and v_level = 'none' then
      raise exception 'Personnalisation du logo non disponible sur ce plan';
    end if;

    if new.accent_color is distinct from old.accent_color and v_level <> 'complete' then
      raise exception 'Personnalisation de la couleur d''accent non disponible sur ce plan';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists shops_prevent_branding_plan_bypass on shops;
create trigger shops_prevent_branding_plan_bypass
  before update on shops
  for each row
  execute function public.prevent_branding_plan_bypass();
