-- ============================================================================
-- Correctifs découverts pendant l'audit du back-office super-admin
-- (22/09/2026, suite de l'audit public/vendeur du même jour). Isaac : "ok, on
-- passe au super admin" — feu vert pour continuer sur le même mode
-- opératoire (corriger directement les bugs francs, documenter le reste).
--
-- Les quatre points ci-dessous sont tous des variantes de la MÊME classe de
-- faille déjà trouvée et corrigée le 13/09/2026 (0008_prevent_privilege_
-- escalation.sql) : une policy RLS `for all`/`for update` qui protège la
-- LIGNE (`auth.uid() = owner_id`) mais pas la COLONNE — donc n'importe quel
-- appelant authentifié peut, par un appel direct à l'API PostgREST (la clé
-- anon/authenticated est publique, visible dans le bundle JS), réécrire une
-- colonne qui ne devrait pourtant pas être sous son contrôle. La leçon était
-- déjà notée dans decisions-techniques.md comme "à garder en tête" ; cette
-- migration applique le même correctif (trigger `BEFORE UPDATE`) aux
-- nouveaux cas trouvés en creusant plus large cette fois, pas seulement sur
-- un signalement précis.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Le compteur anti-abus de claim_guest_orders (ajouté CE MATIN dans
--    0035_secure_guest_order_claim.sql) vivait sur `profiles`, table déjà
--    couverte par `profiles_update_own` (0001_init.sql) — `for update using
--    (auth.uid() = id)`, SANS `with check`, donc sans restriction de colonne
--    au-delà de "c'est bien ma ligne". Un attaquant pouvait donc, avant
--    chaque tentative de rattachement, réinitialiser lui-même son propre
--    compteur :
--
--      supabase.from('profiles')
--        .update({ guest_claim_attempts: 0, guest_claim_window_started_at: null })
--        .eq('id', auth.uid())
--
--    ... ce qui annule complètement la limite de tentatives posée ce matin
--    pour empêcher de deviner un nom par tâtonnement. Contrairement à
--    `profiles.role`/`shops.status` (0008), un trigger "bloquer sauf si
--    admin" ne convient pas ici : ces colonnes doivent au contraire être
--    modifiables par un utilisateur ordinaire, juste UNIQUEMENT via
--    `claim_guest_orders()` elle-même, jamais par écriture directe. La seule
--    façon propre de garantir ça (même leçon que `shop_admin_notes`,
--    0008, déjà sortie de `shops` pour la même raison) : sortir ce compteur
--    de `profiles` dans sa propre table, avec RLS activée et AUCUNE policy —
--    donc fermée à `anon`/`authenticated` par défaut, et accessible
--    uniquement à une fonction `security definer` (qui, possédée par le
--    propriétaire des tables comme le reste du schéma, contourne RLS —
--    exactement le mécanisme déjà utilisé par `claim_guest_orders` elle-même
--    pour écrire des lignes `orders` hors de portée RLS de l'appelant).
-- ----------------------------------------------------------------------------
create table if not exists guest_claim_rate_limits (
  profile_id uuid primary key references profiles (id) on delete cascade,
  attempts integer not null default 0,
  window_started_at timestamptz
);

alter table guest_claim_rate_limits enable row level security;
-- Aucune policy créée volontairement : ni `anon` ni `authenticated` n'ont de
-- droit dessus, quelle que soit la ligne. Seule une fonction `security
-- definer` (propriétaire de la table) peut y lire/écrire.

alter table profiles drop column if exists guest_claim_attempts;
alter table profiles drop column if exists guest_claim_window_started_at;

create or replace function public.claim_guest_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_display_name text;
  v_normalized_phone text;
  v_normalized_name text;
  v_attempts integer;
  v_window_started timestamptz;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;

  insert into guest_claim_rate_limits (profile_id, attempts, window_started_at)
  values (auth.uid(), 0, null)
  on conflict (profile_id) do nothing;

  select attempts, window_started_at
    into v_attempts, v_window_started
    from guest_claim_rate_limits
    where profile_id = auth.uid()
    for update;

  if v_window_started is null or v_window_started < now() - interval '1 hour' then
    update guest_claim_rate_limits
      set attempts = 1, window_started_at = now()
      where profile_id = auth.uid();
  elsif v_attempts >= 8 then
    raise exception 'Trop de tentatives de rattachement. Réessaie dans une heure.';
  else
    update guest_claim_rate_limits
      set attempts = attempts + 1
      where profile_id = auth.uid();
  end if;

  select phone, display_name into v_phone, v_display_name from profiles where id = auth.uid();
  v_normalized_phone := public.normalize_phone_ci(v_phone);
  v_normalized_name := public.normalize_name_ci(v_display_name);

  if v_normalized_phone = '' or length(v_normalized_phone) < 8 then
    return 0;
  end if;

  if v_normalized_name = '' then
    return 0;
  end if;

  update orders
    set customer_id = auth.uid()
    where customer_id is null
      and public.normalize_phone_ci(customer_phone) = v_normalized_phone
      and public.names_plausibly_match(public.normalize_name_ci(customer_name), v_normalized_name);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Signature inchangée -> le grant existant (0014) reste valide.

-- ----------------------------------------------------------------------------
-- 2) `orders_owner_update` (0001_init.sql) et `orders_collaborator_update`
--    (0024_shop_collaborators.sql) sont toutes les deux `for update using
--    (...)` SANS `with check` — donc un vendeur (ou un collaborateur) peut,
--    par appel PostgREST direct sur une commande de SA PROPRE boutique,
--    réécrire n'importe laquelle de ses colonnes : montant, réduction,
--    coordonnées client... et surtout `customer_id` (ajoutée par la
--    migration 0014). Combiné à la policy `orders_customer_read` (`auth.uid()
--    = customer_id`), un vendeur malveillant pourrait attacher l'UUID d'un
--    client (qu'il a pu voir passer sur une commande légitime chez lui) à
--    n'importe laquelle de ses autres commandes — plantant une fausse
--    commande dans l'historique "mes commandes" de quelqu'un qui n'a jamais
--    acheté chez lui. Ça fausserait aussi le CA plateforme affiché à l'admin
--    (`total_amount` librement modifiable après coup).
--
--    Comme pour 0008, un simple `with check` ne suffit pas ici (pas d'accès
--    à l'ancienne valeur de la ligne pour comparer) — trigger `BEFORE UPDATE`
--    à la place, qui bloque tout changement des colonnes "faits de la
--    commande" (jamais censées bouger après création, `status`/`updated_at`
--    mis à part) SAUF pour l'admin, et sauf pour la seule transition
--    légitime de `customer_id` que le code fait réellement : de NULL vers le
--    propre `auth.uid()` de l'appelant (exactement ce que fait
--    `claim_guest_orders` ci-dessus) — jamais vers l'UUID de quelqu'un
--    d'autre, ce qui ferme la faille sans casser cette fonctionnalité.
-- ----------------------------------------------------------------------------
create or replace function public.prevent_order_facts_tampering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.customer_id is distinct from old.customer_id
    and not (old.customer_id is null and new.customer_id = auth.uid())
  then
    raise exception 'Modification du client associé à la commande non autorisée';
  end if;

  if new.shop_id is distinct from old.shop_id
    or new.customer_name is distinct from old.customer_name
    or new.customer_phone is distinct from old.customer_phone
    or new.customer_email is distinct from old.customer_email
    or new.delivery_address is distinct from old.delivery_address
    or new.delivery_lat is distinct from old.delivery_lat
    or new.delivery_lng is distinct from old.delivery_lng
    or new.payment_method is distinct from old.payment_method
    or new.total_amount is distinct from old.total_amount
    or new.delivery_fee is distinct from old.delivery_fee
    or new.promo_code_id is distinct from old.promo_code_id
    or new.discount_amount is distinct from old.discount_amount
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Modification de ces informations de commande non autorisée';
  end if;

  return new;
end;
$$;

drop trigger if exists orders_prevent_facts_tampering on orders;
create trigger orders_prevent_facts_tampering
  before update on orders
  for each row
  execute function public.prevent_order_facts_tampering();

-- ----------------------------------------------------------------------------
-- 3) Même défaut, plus mineur (compteur de vues, pas une donnée sensible) :
--    `shops_owner_all`/`products_owner_all`/`products_collaborator_all` sont
--    `for all`, donc couvrent aussi `shops.view_count` (0005_shop_stats.sql)
--    et `products.view_count` (0025_advanced_stats.sql) — tous deux pensés
--    comme des compteurs uniquement incrémentables via une fonction dédiée
--    (`increment_shop_view`/`increment_product_view`), mais en réalité
--    réinscriptibles à n'importe quelle valeur par le propriétaire via un
--    appel direct. Un vendeur pourrait ainsi gonfler artificiellement ce
--    signal de confiance public. Bloqué en dur (pas de cas légitime où le
--    propriétaire doit changer cette valeur lui-même, contrairement au cas
--    2 ci-dessus) — les fonctions d'incrément restent inchangées, elles sont
--    `security definer` et contournent donc RLS/triggers de la même manière
--    que `claim_guest_orders`.
-- ----------------------------------------------------------------------------
create or replace function public.prevent_view_count_tampering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.view_count is distinct from old.view_count and not public.is_admin() then
    raise exception 'Modification du compteur de vues non autorisée';
  end if;
  return new;
end;
$$;

drop trigger if exists shops_prevent_view_count_tampering on shops;
create trigger shops_prevent_view_count_tampering
  before update on shops
  for each row
  execute function public.prevent_view_count_tampering();

drop trigger if exists products_prevent_view_count_tampering on products;
create trigger products_prevent_view_count_tampering
  before update on products
  for each row
  execute function public.prevent_view_count_tampering();

-- ----------------------------------------------------------------------------
-- 4) `subscriptions` n'a jamais eu de contrainte d'unicité sur `shop_id`,
--    alors que TOUT le code (`getShopSubscription`, `applyPlanToShop`,
--    `start_free_subscription`) suppose une seule ligne par boutique — les
--    deux chemins de création font un "vérifier puis insérer" (pas atomique)
--    plutôt qu'un vrai upsert, donc deux écritures concurrentes (ex :
--    l'admin réassigne un plan pendant qu'un webhook CinetPay confirme un
--    paiement, ou un double clic) peuvent créer DEUX lignes pour la même
--    boutique. Effet concret repéré dans /admin : le compteur "Abonnements
--    actifs" (`admin/page.tsx`, `gt(expires_at, now)`) compte alors cette
--    boutique deux fois, et `/admin/abonnements` peut afficher une ligne
--    différente de celle utilisée ailleurs si l'ordre de retour de la
--    requête change.
--
--    Dédoublonnage AVANT la contrainte (garde la ligne la plus récente par
--    `started_at`, exactement le critère déjà utilisé par
--    `getShopSubscription`) pour que cette migration s'applique proprement
--    même si des doublons existent déjà en base — puis contrainte
--    d'unicité, qui transforme définitivement toute future course en erreur
--    explicite plutôt qu'en doublon silencieux.
-- ----------------------------------------------------------------------------
delete from subscriptions s
where exists (
  select 1 from subscriptions s2
  where s2.shop_id = s.shop_id
    and (s2.started_at, s2.id) > (s.started_at, s.id)
);

alter table subscriptions add constraint subscriptions_shop_id_key unique (shop_id);

-- `start_free_subscription` : reprise à l'identique de sa dernière version
-- (0029_pro_trial_new_shops.sql — offre un mois d'essai Pro, pas un plan
-- gratuit malgré son nom historique, jamais renommée depuis pour ne pas
-- casser son point d'appel dans boutique/actions.ts), seul le "vérifier puis
-- insérer" devient `insert ... on conflict do nothing`, atomique — la
-- contrainte ci-dessus rendait de toute façon l'ancienne version cassante en
-- cas de course, autant la rendre silencieusement sûre comme avant plutôt
-- que de laisser remonter une erreur de contrainte à la création de boutique.
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

  select id into v_pro_plan_id from subscription_plans where code = 'pro';

  insert into subscriptions (shop_id, plan_id, status, started_at, expires_at, is_trial)
  values (p_shop_id, v_pro_plan_id, 'active', now(), now() + interval '30 days', true)
  on conflict (shop_id) do nothing;
end;
$$;

-- Signature inchangée -> le grant existant (0029) reste valide.

-- ----------------------------------------------------------------------------
-- 5) CA plateforme (`/admin`) non plafonné : `orders.select("total_amount")`
--    rapatriait TOUTES les commandes non annulées de la plateforme pour les
--    additionner côté JS — exactement la classe de requête déjà identifiée
--    et corrigée le matin même pour les catégories marketplace
--    (0033_marketplace_filters_performance.sql). À l'échelle validée par
--    Isaac (1000-2000 boutiques), ça devient des dizaines de milliers de
--    lignes rapatriées à chaque chargement du tableau de bord admin, avec un
--    risque de troncature silencieuse (sous-estimation du CA) plutôt qu'une
--    vraie erreur si une limite de lignes est un jour configurée côté
--    PostgREST. Remplacé par une somme calculée directement en base.
--    `security invoker` (pas `definer`) : un appel admin voit la policy
--    `orders_admin_read` (is_admin(), 0007) et obtient donc la vraie somme
--    plateforme ; un appel non-admin resterait limité à ses propres
--    commandes visibles (`orders_owner_read`/`orders_customer_read`), jamais
--    une fuite de CA d'un tiers.
-- ----------------------------------------------------------------------------
create or replace function public.get_platform_revenue()
returns numeric
language sql
security invoker
stable
as $$
  select coalesce(sum(total_amount), 0) from orders where status <> 'cancelled';
$$;

grant execute on function public.get_platform_revenue() to authenticated;
