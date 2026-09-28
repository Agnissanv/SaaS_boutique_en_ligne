-- ============================================================================
-- Limitation de débit sur les points d'entrée publics — 28/09/2026, audit
-- pré-lancement (voir claude/decisions-techniques.md).
--
-- Deux endpoints accessibles sans authentification n'avaient aucune
-- protection contre l'abus : le formulaire de contact (src/app/contact/
-- actions.ts, écrit en base via service role) et l'autocomplete de
-- recherche marketplace (src/app/api/marketplace/search-suggestions/
-- route.ts). Rien de catastrophique en soi (pas de fuite de données), mais
-- un script pourrait spammer contact_messages ou multiplier les requêtes de
-- recherche pour rien.
--
-- Même architecture que `guest_claim_rate_limits` (migration 0036) : RLS
-- activé SANS AUCUNE policy (deny-all par défaut), donc seul un appel via le
-- client service-role ou la fonction security definer ci-dessous peut
-- toucher cette table. Une seule table générique (`scope` + `identifier`)
-- plutôt qu'une table par endpoint : les deux usages actuels ont exactement
-- le même besoin (compter des tentatives par IP sur une fenêtre glissante),
-- et un futur endroit qui en aurait besoin n'a qu'à choisir un nouveau
-- `scope`.
-- ============================================================================

create table if not exists endpoint_rate_limits (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  identifier text not null,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 1,
  unique (scope, identifier)
);

alter table endpoint_rate_limits enable row level security;
-- Aucune policy créée intentionnellement — voir le commentaire en tête de
-- fichier.

-- Nettoyage périodique laissé volontairement de côté : la table reste petite
-- (une ligne par IP/scope actif) et une ligne expirée est simplement
-- réinitialisée à sa prochaine utilisation par la fonction ci-dessous —
-- rien à purger pour que le système reste correct, seulement pour limiter
-- la taille de la table à très long terme. À reconsidérer si la table
-- grossit trop (cron de nettoyage), pas la peine avant.

/**
 * Vérifie et incrémente le compteur de tentatives pour (scope, identifier)
 * sur une fenêtre glissante de p_window_minutes. Renvoie `true` si la
 * tentative est autorisée (et compte comme utilisée), `false` si la limite
 * est atteinte.
 *
 * Un seul UPSERT atomique (pas de SELECT puis UPDATE séparés) : la
 * contrainte unique (scope, identifier) fait qu'un conflit concurrent sur la
 * même ligne est sérialisé par Postgres lui-même, pas besoin de verrou
 * explicite. Le CASE gère la remise à zéro de la fenêtre expirée et
 * l'incrément normal dans la même expression.
 */
create or replace function check_rate_limit(
  p_scope text,
  p_identifier text,
  p_max_attempts integer,
  p_window_minutes integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into endpoint_rate_limits (scope, identifier, window_started_at, attempt_count)
  values (p_scope, p_identifier, now(), 1)
  on conflict (scope, identifier) do update
  set
    attempt_count = case
      when endpoint_rate_limits.window_started_at < now() - (p_window_minutes || ' minutes')::interval
        then 1
      else endpoint_rate_limits.attempt_count + 1
    end,
    window_started_at = case
      when endpoint_rate_limits.window_started_at < now() - (p_window_minutes || ' minutes')::interval
        then now()
      else endpoint_rate_limits.window_started_at
    end
  returning attempt_count into v_count;

  return v_count <= p_max_attempts;
end;
$$;
