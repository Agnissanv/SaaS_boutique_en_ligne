-- ============================================================================
-- Boost marketplace par palier d'abonnement + badge "Boutique vérifiée"
-- (22/09/2026, décision produit d'Isaac suite à l'audit croissance : "les
-- produits des boutiques Pro/Business remontent plus par rapport aux
-- autres... être un peu gentil aussi pour ceux qui ne payent pas". Le boost
-- payant séparé (achat de mise en avant) a été explicitement refusé pour
-- l'instant ("on n'a pas vraiment de trafic... ça ne sert à rien") : ceci ne
-- fait que refléter le palier d'abonnement DÉJÀ payé, jamais un achat
-- additionnel. Voir decisions-techniques.md pour le détail de l'algorithme
-- de tri "jour d'abord, palier ensuite" appliqué côté application
-- (src/lib/marketplace/ranking.ts).
--
-- Pourquoi deux colonnes dénormalisées sur `shops` plutôt qu'une jointure à
-- chaque lecture marketplace : la page d'accueil, les bandes par catégorie
-- et la fiche boutique publique sont TOUTES des lectures publiques à fort
-- trafic (chaque visiteur, connecté ou non, à chaque chargement) — y
-- ajouter une jointure shops -> subscriptions -> subscription_plans sur
-- CHAQUE ligne produit affichée serait coûteux pour une valeur qui ne
-- change qu'à chaque changement de plan (rare, un événement par boutique).
-- `plan_rank`/`is_verified` sont donc calculées UNE fois par changement
-- d'abonnement (trigger ci-dessous), jamais recalculées à la lecture.
--
-- `rank` croissant = priorité de boost plus haute (Pro=1, Business=2,
-- Starter=3) — inversé par rapport au tri par prix croissant utilisé
-- ailleurs (dashboard, admin), puisque c'est ici un rang de PRIORITÉ, pas un
-- montant. `is_verified` réutilise le même principe "aucune valeur codée en
-- dur dans le trigger" que `prevent_branding_plan_bypass` (migration 0037) :
-- la nouvelle clé jsonb `has_verified_badge` est LUE depuis
-- `subscription_plans.features`, jamais recopiée depuis un `if code = ...`
-- — changer les paliers dans le jsonb change le comportement du trigger
-- sans toucher à cette migration.
--
-- Badge "Boutique vérifiée" réservé à Business + Pro (Starter reste
-- éligible au boost par palier — voir `rank` ci-dessus — mais pas au badge
-- de confiance : distinction volontaire entre "un peu plus visible" et
-- "vérifié", pour ne pas dévaluer le badge).
-- ============================================================================

alter table subscription_plans add column if not exists rank smallint;

update subscription_plans set rank = 1 where code = 'pro';
update subscription_plans set rank = 2 where code = 'business';
update subscription_plans set rank = 3 where code = 'starter';

alter table subscription_plans alter column rank set default 3;
alter table subscription_plans alter column rank set not null;

update subscription_plans
set features = jsonb_set(features, '{has_verified_badge}', 'true')
where code in ('business', 'pro');

-- Dénormalisation sur `shops`, tenue à jour uniquement par le trigger
-- ci-dessous — jamais recalculée à la volée côté lecture marketplace.
-- Défaut = Starter (3 / non vérifié), cohérent avec `start_free_subscription`
-- qui crée systématiquement un abonnement avant qu'une boutique ne devienne
-- visible publiquement.
alter table shops add column if not exists plan_rank smallint not null default 3;
alter table shops add column if not exists is_verified boolean not null default false;

create or replace function public.sync_shop_plan_denormalization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rank smallint;
  v_verified boolean;
begin
  select sp.rank, coalesce((sp.features ->> 'has_verified_badge')::boolean, false)
  into v_rank, v_verified
  from subscription_plans sp
  where sp.id = new.plan_id;

  update shops
  set plan_rank = coalesce(v_rank, 3),
      is_verified = coalesce(v_verified, false)
  where id = new.shop_id;

  return new;
end;
$$;

drop trigger if exists subscriptions_sync_shop_plan_denormalization on subscriptions;
create trigger subscriptions_sync_shop_plan_denormalization
  after insert or update of plan_id on subscriptions
  for each row
  execute function public.sync_shop_plan_denormalization();

-- Rétrogradation automatique (subscription-lifecycle.ts, 22/09/2026) : passe
-- par `applyPlanToShop`, qui fait un upsert sur `subscriptions` — capté par
-- ce même trigger (`insert or update of plan_id`), donc aucune synchronisation
-- supplémentaire à écrire côté cron.

-- Backfill des boutiques existantes (abonnement le plus récent par
-- `started_at`, même critère que `shop_branding_level`/`getShopSubscription`
-- côté TypeScript).
update shops sh
set plan_rank = coalesce(latest.rank, 3),
    is_verified = coalesce(latest.verified, false)
from (
  select distinct on (s.shop_id)
    s.shop_id,
    sp.rank,
    coalesce((sp.features ->> 'has_verified_badge')::boolean, false) as verified
  from subscriptions s
  join subscription_plans sp on sp.id = s.plan_id
  order by s.shop_id, s.started_at desc
) latest
where sh.id = latest.shop_id;
