-- ============================================================================
-- Personnalisation de la marque (`can_customize_branding`, plans Business et
-- Pro) — 16/09/2026. Spec tranchée par Isaac : Basic (Business) = changer le
-- logo affiché sur la boutique publique ; Complete (Pro) = logo + couleur
-- d'accent personnalisée.
--
-- `shops.logo_url` existe déjà depuis le tout premier schéma
-- (0001_init.sql) et était jusqu'ici modifiable par TOUS les vendeurs sans
-- vérification de plan — vérifié en cherchant son usage dans shop-form.tsx.
-- Comme pour `has_order_notifications` (migration 0020), ce n'était donc pas
-- à construire mais à faire enfin respecter : le vrai travail ci-dessous
-- est la gating de `logo_url` (Business+) côté code (boutique/actions.ts,
-- boutique/page.tsx, shop-form.tsx) et la nouvelle colonne pour la couleur
-- d'accent (Pro).
-- ============================================================================

alter table shops
  add column if not exists accent_color text check (
    accent_color is null or accent_color ~ '^#[0-9a-fA-F]{6}$'
  );
