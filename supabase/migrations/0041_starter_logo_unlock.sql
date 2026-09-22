-- ============================================================================
-- Déblocage du logo de boutique sur le plan Starter (gratuit) — 22/09/2026,
-- décision produit d'Isaac suite à l'audit pré-lancement des plans
-- d'abonnement. Isaac hésitait entre augmenter la limite de produits
-- Starter (2 → 3) ou débloquer le logo/la bannière ; la bannière
-- (`cover_url`) est déjà gratuite pour tous les plans (jamais gatée par
-- `can_customize_branding`, voir boutique/actions.ts) — seul le logo était
-- réservé à Business+. Isaac a choisi de débloquer le logo plutôt que
-- d'augmenter la limite de produits : cohérent avec le problème que KEVA
-- résout dès le départ (cahier_de_charge.md §1.1, "image peu
-- professionnelle" des vendeurs WhatsApp) — bloquer le logo sur le plan
-- gratuit va à l'encontre de ça pour les vendeurs qu'on cible en premier.
-- Le nombre de produits reste un meilleur levier de conversion (delta 2→3
-- trop faible pour changer grand-chose, alors que la limite de produits est
-- le signal naturel qui pousse à passer à un plan supérieur).
--
-- Changement unique : `can_customize_branding` passe de "none" à "basic"
-- pour le plan Starter. Aucun changement de code applicatif nécessaire —
-- `boutique/actions.ts` (canCustomizeBranding !== "none") et le trigger
-- `prevent_branding_plan_bypass` (0037_branding_plan_gate.sql) lisent tous
-- les deux CETTE MÊME valeur en base en temps réel : la changer ici change
-- le comportement des deux côtés instantanément, sans toucher au code.
--
-- La couleur d'accent (`accent_color`, réservée à "complete"/Pro) n'est PAS
-- concernée par ce changement — reste un avantage Pro exclusif.
--
-- `DEFAULT_FEATURE_FLAGS` (subscription.ts, filet de sécurité pour une
-- boutique sans abonnement du tout) reste volontairement à "none" : ce cas
-- est anormal (échec de `start_free_subscription`), pas un vrai plan
-- Starter — voir le commentaire mis à jour dans subscription.ts.
-- ============================================================================

update subscription_plans
set features = jsonb_set(features, '{can_customize_branding}', '"basic"')
where code = 'starter';
