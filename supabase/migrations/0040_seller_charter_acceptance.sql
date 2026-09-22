-- ============================================================================
-- Charte vendeur obligatoire à l'inscription — demande d'Isaac le 22/09/2026,
-- suite à la question d'un futur vendeur dans le groupe d'accès anticipé sur
-- les produits autorisés/interdits. Jusqu'ici les règles n'existaient que
-- dans les conditions d'utilisation (page rarement lue en entier) : Isaac
-- veut une étape obligatoire, lue et validée explicitement, avant qu'un
-- vendeur puisse continuer vers son dashboard/la création de sa boutique.
--
-- Deux colonnes plutôt qu'un simple booléen "accepté" : `shop_charter_version`
-- permet de forcer une nouvelle acceptation le jour où la charte change
-- (Isaac augmente `CURRENT_SELLER_CHARTER_VERSION` côté code — voir
-- src/lib/seller-charter.ts — et tout compte resté sur une version
-- inférieure est renvoyé vers /charte-vendeur au prochain accès au
-- dashboard), sans avoir besoin d'une nouvelle migration à chaque mise à
-- jour du texte. `default 0` = "jamais accepté" pour tous les comptes
-- existants (cohérent avec `CURRENT_SELLER_CHARTER_VERSION = 1` qui démarre
-- au-dessus).
--
-- Pas de nouvelle policy nécessaire : `profiles_update_own` (0001_init.sql)
-- autorise déjà chaque compte à modifier sa propre ligne, et le trigger de
-- 0008_prevent_privilege_escalation.sql ne bloque que la colonne `role` —
-- ces deux nouvelles colonnes restent librement modifiables par leur
-- propriétaire, ce qui est exactement ce qu'il faut ici.
-- ============================================================================

alter table profiles add column if not exists shop_charter_accepted_at timestamptz;
alter table profiles add column if not exists shop_charter_version smallint not null default 0;
