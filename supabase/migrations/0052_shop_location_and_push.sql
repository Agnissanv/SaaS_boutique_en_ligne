-- ============================================================================
-- Deux demandes d'Isaac du 01/10/2026, dans le même échange :
--
-- 1) Localisation boutique + tri marketplace par proximité — "les produits
--    doivent s'afficher par rapport à la position de la personne la plus
--    proche" (façon Facebook Marketplace). Question posée en retour ("ville
--    seulement" vs "GPS précis") : réponse d'Isaac "ville et commune si
--    possible". Voir src/lib/geo/ci-locations.ts pour la nuance pas discutée
--    explicitement mais nécessaire : `commune` n'a de sens que pour Abidjan
--    (district autonome multi-communes) — ailleurs (Korhogo, Yamoussoukro...,
--    villes citées par Isaac lui-même), `ville` seule suffit. Pas de colonne
--    lat/lng sur `shops` : la position du VISITEUR (navigateur, gratuite,
--    même principe que la position GPS de livraison — migration 0006) est
--    résolue côté client vers la ville/commune connue la plus proche, puis
--    comparée en texte à `shops.ville`/`shops.commune` — pas de calcul de
--    distance côté base.
--
-- 2) Notifications push (web push), pour que les vendeurs reçoivent une
--    notification même hors du site/app — table `push_subscriptions` ici ;
--    voir src/lib/push/send-push.ts et l'API route /api/push/trigger pour
--    l'envoi, déclenché par un trigger pg_net sur `notifications` plus bas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Localisation boutique
-- ----------------------------------------------------------------------------
alter table shops add column if not exists ville text;
alter table shops add column if not exists commune text;

create index if not exists shops_ville_idx on shops (ville);

-- Notification (espace "/dashboard/notifications", voir lib/notifications.ts
-- — type `admin_message`, en base depuis la migration 0030 mais jamais émis
-- nulle part jusqu'ici) à chaque boutique déjà active sans localisation : le
-- tri par proximité ne peut rien pour une boutique qui n'a pas encore
-- renseigné sa ville. `where ville is null` rend ce bloc rejouable sans
-- double-notifier une boutique qui a déjà renseigné sa ville entre-temps.
insert into notifications (profile_id, title, body, link, kind)
select
  owner_id,
  'Ajoute la localisation de ta boutique',
  'Les visiteurs voient maintenant en premier les boutiques les plus proches d''eux. Renseigne la ville (et la commune si tu es à Abidjan) de ta boutique dans "Ma boutique" pour ne pas rester invisible.',
  '/dashboard/boutique',
  'admin_message'
from shops
where status = 'active' and ville is null;

-- ----------------------------------------------------------------------------
-- 2) Notifications push (Web Push API — gratuite, aucune clé tierce à payer,
-- juste une paire de clés VAPID auto-générée pour authentifier KEVA auprès
-- des services de push des navigateurs). Un profil peut avoir plusieurs
-- abonnements (un par appareil/navigateur où il a activé les notifications).
-- ----------------------------------------------------------------------------
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_profile_id_idx on push_subscriptions (profile_id);

alter table push_subscriptions enable row level security;

-- Même modèle que "shops_owner_all" (0001_init.sql) : un utilisateur gère
-- uniquement ses propres abonnements (s'abonner/se désabonner depuis son
-- espace "Paramètres > Notifications").
create policy "push_subscriptions_owner_all" on push_subscriptions for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- ----------------------------------------------------------------------------
-- 3) Déclenchement de l'envoi push à chaque notification créée.
--
-- `notifications` est alimentée par des inserts SQL directs à l'intérieur de
-- fonctions `security definer` (create_order, cancel_order...) — pas par un
-- point de passage JS unique qu'on pourrait équiper d'un appel réseau. Un
-- trigger AFTER INSERT + l'extension `pg_net` (fournie par Supabase, fait un
-- appel HTTP asynchrone depuis Postgres, sans bloquer l'insert ni l'opération
-- qui l'a déclenché) permet de rester 100% dans les migrations, sans
-- configuration manuelle dans le Dashboard Supabase (Database Webhooks).
--
-- Si `create extension pg_net` échoue faute de droits sur ce projet
-- Supabase : l'activer une fois manuellement dans Dashboard > Database >
-- Extensions > pg_net, puis rejouer cette migration (le `create extension
-- if not exists` plus bas redeviendra un no-op, le reste s'applique).
--
-- Secret partagé (`x-push-secret`, comparé dans /api/push/trigger) : même
-- principe que `SEND_SMS_HOOK_SECRET` déjà utilisé sur le webhook Auth SMS
-- (voir .env.example) — empêche un tiers qui devinerait l'URL de la route de
-- déclencher l'envoi de push pour un `notification_id` arbitraire.
-- URL en dur (https://shopkeva.com, déjà la valeur de NEXT_PUBLIC_SITE_URL)
-- plutôt qu'un paramètre Postgres à part : plus simple, cohérent avec le
-- choix déjà fait ailleurs dans le projet (ex. metadataBase) de ne pas
-- introduire un mécanisme de config séparé pour une seule URL publique fixe.
-- ============================================================================
create extension if not exists pg_net with schema extensions;

create or replace function public.trigger_push_on_new_notification()
returns trigger
language plpgsql
security definer
set search_path = public, net, extensions
as $$
begin
  perform net.http_post(
    url := 'https://shopkeva.com/api/push/trigger',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', '213bb208610066ecfea848cd6cf240dcc4b416aeb465017047ecdad714d3e47b'
    ),
    body := jsonb_build_object('notification_id', new.id)
  );
  return new;
exception when others then
  -- Best-effort : jamais bloquer la création de la notification elle-même
  -- (même principe "non bloquant" que les emails/SMS ailleurs dans le projet)
  -- si pg_net est indisponible ou que l'appel échoue.
  return new;
end;
$$;

drop trigger if exists push_on_new_notification on notifications;
create trigger push_on_new_notification
  after insert on notifications
  for each row
  execute function public.trigger_push_on_new_notification();
