-- ============================================================================
-- Durcissement de claim_guest_orders() (22/09/2026, audit pré-lancement).
--
-- Faille identifiée : claim_guest_orders (migration 0014) rattache au compte
-- connecté TOUTE commande invité dont le téléphone normalisé correspond à
-- celui du profil — or `profiles.phone` est un champ texte libre, modifiable
-- à volonté par le client lui-même (compte/profil/actions.ts), sans aucune
-- vérification qu'il possède réellement ce numéro. Combiné à la policy RLS
-- `orders_customer_read` (auth.uid() = customer_id), n'importe qui connaissant
-- (ou devinant) le numéro de téléphone d'une autre personne pouvait créer un
-- compte, renseigner ce numéro comme téléphone de profil, cliquer sur
-- "Rattacher mes anciennes commandes", et lire en permanence tout son
-- historique de commandes — nom, adresse/position de livraison, articles,
-- montants — chez n'importe quel vendeur de la plateforme.
--
-- Une vérification par SMS (OTP) réglerait ça proprement mais a un coût par
-- envoi, déjà écarté par Isaac pour l'authentification (email OTP retenu,
-- téléphone OTP explicitement reporté — voir plus haut dans ce document).
-- Approche retenue à la place, sans aucun coût récurrent, en deux volets :
--
--   1) Exiger que le NOM corresponde en plus du téléphone. Un attaquant qui
--      connaît juste un numéro de téléphone (WhatsApp, carte de visite...)
--      ne connaît pas forcément le nom exact tapé au moment de la commande.
--      Comparaison volontairement tolérante (normalisation qui ignore
--      espaces/apostrophes/casse + correspondance par inclusion dans un sens
--      ou l'autre) pour absorber "Awa" vs "Awa Koné" ou "N'Guessan" vs
--      "Nguessan" sans bloquer un vrai client — un compromis assumé, pas une
--      garantie parfaite contre quelqu'un qui connaît à la fois le téléphone
--      ET le nom exact de sa cible.
--   2) Limiter les tentatives de rattachement par profil (fenêtre glissante
--      d'une heure) : sans ça, un attaquant pourrait modifier son nom de
--      profil en boucle et retenter jusqu'à tomber juste. Rate-limiting par
--      profil plutôt que par IP, cette fonction n'ayant de toute façon pas
--      accès à l'IP de l'appelant.
--
-- Ces deux mesures réduisent fortement le risque (il faut désormais connaître
-- téléphone ET nom, et deviner en un nombre limité d'essais) sans l'éliminer
-- à 100% — signalé honnêtement à Isaac. Une vérification SMS resterait la
-- seule solution complètement étanche, à envisager si un abus réel est
-- constaté malgré ce correctif.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Compteur de tentatives par profil (anti-boucle "je change mon nom et je
--    retente"). Fenêtre glissante gérée entièrement dans claim_guest_orders
--    ci-dessous plutôt que par un job de nettoyage séparé.
-- ----------------------------------------------------------------------------
alter table profiles add column if not exists guest_claim_attempts integer not null default 0;
alter table profiles add column if not exists guest_claim_window_started_at timestamptz;

-- ----------------------------------------------------------------------------
-- 2) Normalisation de nom — même esprit que normalize_phone_ci (0014) : ne
--    garder que lettres/chiffres, en minuscule, via les classes POSIX
--    `[:alnum:]` (testé directement contre un vrai Postgres avant d'écrire
--    cette note : les échappements Unicode `\p{L}`/`\p{N}` d'autres moteurs
--    de regex n'existent PAS dans celui de Postgres — `invalid regular
--    expression: invalid escape \ sequence`). `[:alnum:]` dépend de la
--    locale du serveur (LC_CTYPE) : sur le en_US.UTF-8 standard d'un projet
--    Supabase, un caractère accentué (é, í...) est reconnu comme
--    alphanumérique et conservé ; si jamais ce n'était pas le cas, il serait
--    simplement retiré des deux côtés de la comparaison — un faux négatif
--    occasionnel possible (nom mal reconnu), jamais un faux positif.
--    Absorbe "N'Guessan Yao", "N Guessan Yao" et "Nguessan-Yao" en une seule
--    forme comparable. Volontairement sans l'extension `unaccent` : pas
--    nécessaire pour ce résultat, et un correctif de sécurité n'est pas le
--    bon moment pour ajouter une dépendance supplémentaire.
-- ----------------------------------------------------------------------------
create or replace function public.normalize_name_ci(p_name text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(coalesce(p_name, ''), '[^[:alnum:]]+', '', 'g'));
$$;

-- Correspondance tolérante entre deux noms déjà normalisés : égalité stricte,
-- ou inclusion dans un sens ou l'autre (gère un nom partiel donné à la
-- commande, ex. juste le prénom, par rapport au nom complet du profil).
-- Seuil de 3 caractères pour éviter qu'un nom très court (initiales...)
-- ne "matche" par simple inclusion avec à peu près n'importe quoi.
create or replace function public.names_plausibly_match(p_a text, p_b text)
returns boolean
language sql
immutable
as $$
  select
    length(p_a) >= 3 and length(p_b) >= 3
    and (p_a = p_b or p_a like '%' || p_b || '%' or p_b like '%' || p_a || '%');
$$;

-- ----------------------------------------------------------------------------
-- 3) claim_guest_orders — téléphone ET nom désormais requis, plus limite de
--    tentatives par profil.
-- ----------------------------------------------------------------------------
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

  -- Anti-abus : verrouille la ligne du profil pour éviter une course entre
  -- deux appels concurrents qui liraient tous les deux "encore de la marge"
  -- avant que l'un des deux n'incrémente.
  select guest_claim_attempts, guest_claim_window_started_at
    into v_attempts, v_window_started
    from profiles where id = auth.uid()
    for update;

  if v_window_started is null or v_window_started < now() - interval '1 hour' then
    update profiles
      set guest_claim_attempts = 1, guest_claim_window_started_at = now()
      where id = auth.uid();
  elsif v_attempts >= 8 then
    raise exception 'Trop de tentatives de rattachement. Réessaie dans une heure.';
  else
    update profiles
      set guest_claim_attempts = guest_claim_attempts + 1
      where id = auth.uid();
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
