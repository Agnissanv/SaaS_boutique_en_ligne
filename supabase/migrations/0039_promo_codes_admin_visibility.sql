-- ============================================================================
-- Visibilité admin sur les codes promo — dernier trou du bloc "priorité 2"
-- de l'audit back-office (22/09/2026). `promo_codes` (0023_promo_codes.sql)
-- n'a jamais eu de policy admin, contrairement à `shops`/`orders`/`payments`/
-- `subscriptions` qui en ont toutes une depuis 0007_admin_backoffice.sql —
-- un simple oubli à l'ajout de la fonctionnalité le 16/09/2026, jamais
-- comblé depuis. Sans ça, aucune page admin ne peut lire cette table, quel
-- que soit le code qu'on écrirait par-dessus.
-- ============================================================================

create policy "promo_codes_admin_read" on promo_codes
  for select using (is_admin());
