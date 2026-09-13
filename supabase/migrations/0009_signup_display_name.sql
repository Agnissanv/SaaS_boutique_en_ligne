-- ============================================================================
-- Prend en compte le nom saisi à l'inscription (§ nouvelle page /inscription,
-- ajoutée le 13/09/2026 suite à la demande d'Isaac d'avoir un vrai formulaire
-- d'inscription plutôt que la création implicite de compte par lien magique).
--
-- `handle_new_user()` (0002_profile_trigger.sql) utilisait jusqu'ici toujours
-- la partie locale de l'email comme nom d'affichage temporaire. Le nouveau
-- formulaire d'inscription passe le nom saisi via `options.data.display_name`
-- au moment de `supabase.auth.signUp()` — Supabase stocke ça immédiatement
-- dans `auth.users.raw_user_meta_data`, disponible dès l'insert qui déclenche
-- ce trigger (avant même la confirmation de l'email, donc ça fonctionne que
-- la confirmation par email soit activée ou non côté projet).
--
-- Le lien magique (`signInWithOtp`) ne fournit pas ce champ : la valeur de
-- repli (partie locale de l'email) reste donc inchangée pour ce chemin.
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
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
      split_part(new.email, '@', 1),
      new.phone,
      'Vendeur'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
