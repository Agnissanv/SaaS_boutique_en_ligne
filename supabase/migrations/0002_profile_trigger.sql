-- ============================================================================
-- Trigger : création automatique du profil à l'inscription
--
-- Sans ce trigger, un nouvel utilisateur Supabase Auth (table auth.users)
-- n'a aucune ligne correspondante dans `profiles`, alors que tout le reste
-- du schéma (shops.owner_id, RLS "profiles_select_own", etc.) suppose que
-- profiles.id = auth.users.id existe dès la connexion.
--
-- `security definer` est nécessaire : la fonction doit pouvoir écrire dans
-- `profiles` (protégée par RLS) alors qu'elle est appelée dans le contexte
-- de création de l'utilisateur, avant qu'il n'ait de session/JWT.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    -- Avant configuration du profil : on utilise la partie locale de
    -- l'email (ou du téléphone) comme nom d'affichage temporaire.
    coalesce(split_part(new.email, '@', 1), new.phone, 'Vendeur')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
