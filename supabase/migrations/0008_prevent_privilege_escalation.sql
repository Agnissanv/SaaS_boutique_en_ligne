-- ============================================================================
-- Faille trouvée par Isaac le 13/09/2026 : "n'importe qui peut arriver
-- facilement sur la page admin".
--
-- Root cause : `profiles_update_own` (0001_init.sql) autorise chaque
-- utilisateur à modifier SA PROPRE ligne `profiles`, mais ne restreint
-- aucune colonne — juste la propriété de la ligne (`auth.uid() = id`).
-- Sans `WITH CHECK` explicite, Postgres réutilise la clause `USING` pour la
-- vérification post-update, qui ne dit toujours rien sur les valeurs. Résultat :
-- n'importe quel compte vendeur connecté peut, avec la clé publique anon
-- (visible dans le bundle JS de tout le monde, ce n'est pas un secret), faire
-- directement depuis la console du navigateur :
--
--   supabase.from('profiles').update({ role: 'admin' }).eq('id', user.id)
--
-- ... et atterrir sur /admin (le layout ne vérifie que `profiles.role`, qui
-- vient d'être trafiqué). Aucun code applicatif ne propose ce champ dans un
-- formulaire, mais RLS ne protège que les LIGNES, pas les COLONNES : ça ne
-- suffit pas si rien d'autre n'empêche d'écrire n'importe quelle colonne
-- d'une ligne qu'on possède déjà.
--
-- Même défaut, deuxième occurrence trouvée en creusant le même problème :
-- `shops_owner_all` (0001_init.sql) donne au propriétaire un accès complet
-- (`for all`) à sa propre boutique, `status` inclus. Un vendeur suspendu par
-- l'admin pouvait donc se réactiver lui-même en une seule requête —
-- annulant complètement la fonctionnalité de suspension livrée dans
-- 0007_admin_backoffice.sql.
--
-- Fix : des triggers `BEFORE UPDATE` qui bloquent tout changement des
-- colonnes sensibles (`profiles.role`, `shops.status`) sauf si l'auteur de
-- la requête est déjà admin (`is_admin()`, security definer, insensible à
-- la ligne en cours de modification). Choisi plutôt qu'un `WITH CHECK` RLS
-- (qui n'a pas d'accès simple à l'ancienne valeur de la ligne) : un trigger
-- s'applique uniformément, quel que soit le chemin d'écriture (Server
-- Action, appel PostgREST direct, futur outil interne...).
-- ============================================================================

create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Modification du rôle non autorisée';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_escalation on profiles;
create trigger profiles_prevent_role_escalation
  before update on profiles
  for each row
  execute function public.prevent_role_self_escalation();

create or replace function public.prevent_shop_status_self_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status and not public.is_admin() then
    raise exception 'Modification du statut de la boutique réservée à l''administration';
  end if;
  return new;
end;
$$;

drop trigger if exists shops_prevent_status_self_change on shops;
create trigger shops_prevent_status_self_change
  before update on shops
  for each row
  execute function public.prevent_shop_status_self_change();

-- ----------------------------------------------------------------------------
-- Nettoyage associé, trouvé en revérifiant les accès autour de la même
-- policy `shops_owner_all` : `shops.admin_notes` (ajoutée dans
-- 0007_admin_backoffice.sql pour le "support basique") était lisible ET
-- modifiable par le vendeur propriétaire lui-même via cette même policy —
-- une note censée être interne à l'admin n'avait donc rien de privé. RLS
-- étant par ligne et non par colonne, la seule façon propre de rendre une
-- colonne admin-only est de la sortir dans sa propre table, avec ses
-- propres policies.
-- ----------------------------------------------------------------------------
alter table shops drop column if exists admin_notes;

create table if not exists shop_admin_notes (
  shop_id uuid primary key references shops (id) on delete cascade,
  note text,
  updated_at timestamptz not null default now()
);

alter table shop_admin_notes enable row level security;

create policy "shop_admin_notes_admin_all" on shop_admin_notes for all
  using (is_admin()) with check (is_admin());
