-- ============================================================================
-- Secret des notifications push lu dans Supabase Vault
-- — 09/10/2026 (audit de sécurité, point 10).
--
-- Problème : la migration 0052 écrivait la valeur du secret partagé
-- `x-push-secret` en clair dans le trigger `trigger_push_on_new_notification`.
-- Cette valeur est donc dans le dépôt git (et son historique) : quiconque lit
-- le dépôt peut appeler /api/push/trigger.
--
-- Correctif : le trigger lit désormais le secret dans Supabase Vault (secret
-- nommé `push_internal_secret`), jamais dans une migration. L'ancienne valeur
-- doit être considérée comme compromise et REMPLACÉE.
--
-- ⚠️ ÉTAPES À FAIRE DANS CET ORDRE (sinon les push s'arrêtent) :
--   1. Générer un nouveau secret (ex. `openssl rand -hex 32`).
--   2. Supabase > SQL Editor, exécuter (en remplaçant la valeur, et SANS
--      jamais l'enregistrer dans un fichier du dépôt) :
--        select vault.create_secret('<NOUVEAU_SECRET>', 'push_internal_secret');
--   3. Vercel > Settings > Environment Variables : mettre la même valeur dans
--      PUSH_INTERNAL_SECRET (Production), puis redéployer.
--   4. Exécuter cette migration.
-- Tant que le secret Vault n'existe pas, le trigger n'envoie simplement rien
-- (best-effort, la notification elle-même est toujours créée).
-- ============================================================================

create or replace function public.trigger_push_on_new_notification()
returns trigger
language plpgsql
security definer
set search_path = public, net, extensions
as $$
declare
  v_secret text;
begin
  select decrypted_secret
    into v_secret
    from vault.decrypted_secrets
    where name = 'push_internal_secret'
    limit 1;

  if v_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://shopkeva.com/api/push/trigger',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', v_secret
    ),
    body := jsonb_build_object('notification_id', new.id)
  );
  return new;
exception when others then
  -- Best-effort : jamais bloquer la création de la notification elle-même
  -- (même principe que 0052) si Vault, pg_net ou l'appel échoue.
  return new;
end;
$$;
