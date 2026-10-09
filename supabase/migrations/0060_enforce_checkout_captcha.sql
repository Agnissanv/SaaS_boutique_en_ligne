-- ============================================================================
-- Captcha à la commande — étape 2/2 : le rendre OBLIGATOIRE
-- — 09/10/2026.
--
-- À exécuter UNIQUEMENT quand :
--   1. la migration 0059 est appliquée ;
--   2. NEXT_PUBLIC_TURNSTILE_SITE_KEY et TURNSTILE_SECRET_KEY sont sur Vercel
--      (Production) et le site a été redéployé avec ;
--   3. une commande test en production a réussi avec le widget affiché.
-- Sinon, plus aucune commande ne passe.
--
-- Retour arrière (en cas de problème) : exécuter la même fonction avec
-- `select false;` — les commandes repassent immédiatement sans captcha.
-- ============================================================================

create or replace function public.checkout_captcha_required()
returns boolean
language sql
stable
as $$
  select true;
$$;
