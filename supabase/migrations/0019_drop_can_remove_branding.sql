-- ============================================================================
-- Retrait définitif de "can_remove_branding" (16/09/2026).
--
-- Décision produit d'Isaac, prise en repensant la refonte des plans
-- d'abonnement (0016_subscription_plans_v2.sql) : le badge KEVA doit rester
-- visible sur toutes les boutiques, quel que soit le plan souscrit — jamais
-- une fonctionnalité à vendre à un plan supérieur. Le flag n'avait de toute
-- façon jamais été câblé à quoi que ce soit (le badge n'existe même pas
-- encore visuellement sur les boutiques) : on le retire du jsonb plutôt que
-- de le laisser à `false`/`true` sans effet, pour qu'il ne puisse pas
-- resurgir par erreur dans une carte de plan ou une future fonctionnalité.
--
-- `-` sur un jsonb retire la clé si présente, ne fait rien sinon — sûr à
-- rejouer, et couvre les 3 plans quel que soit leur `code` actuel.
-- ============================================================================

update subscription_plans
set features = features - 'can_remove_branding';
