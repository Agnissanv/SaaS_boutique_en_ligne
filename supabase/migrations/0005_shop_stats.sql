-- ============================================================================
-- Statistiques boutique (cf. cahier des charges §3.1.A.4 : nombre de vues,
-- nombre de commandes, CA jour/semaine/mois, alertes stock bas).
--
-- Seul le compteur de vues nécessite une nouvelle colonne + une fonction RPC :
-- c'est la seule statistique qui doit pouvoir être incrémentée par un visiteur
-- anonyme (à chaque affichage de la page boutique publique). Les autres
-- statistiques (commandes, CA, stock bas) sont déjà lisibles par le vendeur
-- via les policies RLS existantes sur `orders`/`products` — pas besoin de RPC,
-- de simples requêtes filtrées suffisent côté dashboard.
--
-- `increment_shop_view` reste volontairement un simple compteur global (pas de
-- déduplication par visiteur/IP/session) : les vues uniques et le taux de
-- conversion sont listés "Priorité 2" dans le cahier des charges.
-- ============================================================================

alter table shops add column if not exists view_count bigint not null default 0;

create or replace function increment_shop_view(p_shop_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update shops
  set view_count = view_count + 1
  where slug = p_shop_slug and status = 'active';
end;
$$;

grant execute on function increment_shop_view(text) to anon, authenticated;
