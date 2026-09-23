-- =====================================================================
-- KEVA — Remise a zero de la base avant lancement (23/09/2026)
-- A executer manuellement dans le SQL Editor de Supabase.
-- NE PAS ajouter a supabase/migrations/ : operation ponctuelle,
-- pas un changement de schema.
--
-- Garde   : le compte admin (valenbouge@gmail.com) et son profil,
--           ainsi que la table de reference `subscription_plans`.
-- Supprime: tous les autres comptes (auth.users) et tout ce qui en
--           depend en cascade (boutiques, produits, commandes, avis,
--           notifications, etc.), plus `payments`, `transaction_logs`
--           et `contact_messages` qui NE se videraient PAS tout seuls
--           (cles etrangeres en ON DELETE SET NULL, ou aucune cle
--           etrangere du tout selon les migrations).
--
-- IRREVERSIBLE. Assure-toi que ton export (backup_avant_lancement.sql)
-- est bien accessible avant d'executer l'ETAPE 2.
-- =====================================================================


-- ---------------------------------------------------------------------
-- ETAPE 1 — Verification (a executer et relire AVANT toute suppression)
-- ---------------------------------------------------------------------
-- Doit renvoyer EXACTEMENT 1 ligne, avec le bon id.
SELECT id, email, created_at
FROM auth.users
WHERE email = 'valenbouge@gmail.com';

-- Combien de comptes vont etre supprimes.
SELECT count(*) AS comptes_a_supprimer
FROM auth.users
WHERE email <> 'valenbouge@gmail.com';


-- ---------------------------------------------------------------------
-- ETAPE 2 — Suppression (irreversible)
-- ---------------------------------------------------------------------
-- `orders_prevent_facts_tampering` (migration 0036) bloque toute
-- modification de orders.customer_id / orders.promo_code_id par un
-- appelant non-admin — y compris la mise a NULL automatique que
-- declenche la suppression d'un compte client ou d'un code promo,
-- puisque l'editeur SQL n'a pas de session admin identifiee
-- (auth.uid() y est NULL). On le desactive donc le temps de
-- l'operation, puis on le reactive aussitot — le tout dans une seule
-- transaction : si quoi que ce soit echoue, tout est annule
-- automatiquement, trigger reactive compris.
BEGIN;

ALTER TABLE public.orders DISABLE TRIGGER orders_prevent_facts_tampering;

DO $$
DECLARE
  admin_id uuid;
BEGIN
  SELECT id INTO admin_id
  FROM auth.users
  WHERE email = 'valenbouge@gmail.com';

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Compte admin introuvable (valenbouge@gmail.com) — arret, rien n''a ete supprime.';
  END IF;

  -- Tables qui NE cascadent PAS depuis auth.users (ON DELETE SET NULL,
  -- ou pas de cle etrangere du tout) : a vider explicitement.
  DELETE FROM public.payments;
  DELETE FROM public.transaction_logs;
  DELETE FROM public.contact_messages;

  -- order_items.product_id et order_item_variants.variant_id n'ont PAS
  -- de ON DELETE cascade/set null (0001_init.sql / 0010_...sql) — donc
  -- sans cette suppression explicite, la cascade depuis auth.users
  -- essaie de supprimer un produit/une variante encore reference(e)
  -- par un order_item, et Postgres refuse (contrainte de cle
  -- etrangere violee). order_item_variants se vide tout seul en
  -- cascade derriere (order_item_id -> order_items, on delete cascade).
  DELETE FROM public.order_items;

  -- Tout le reste (profiles, shops, products, orders, promo_codes,
  -- subscriptions, shop_admin_notes, shop_page_views, abandoned_carts,
  -- shop_collaborators, product_images, product_variants,
  -- product_reviews, order_item_variants, notifications,
  -- guest_claim_rate_limits) part en cascade depuis auth.users.
  -- `subscription_plans` n'a aucune cle etrangere qui la vise : elle
  -- n'est pas touchee, elle reste intacte comme demande.
  DELETE FROM auth.users WHERE id <> admin_id;

  RAISE NOTICE 'Base videe. Compte conserve : %', admin_id;
END $$;

ALTER TABLE public.orders ENABLE TRIGGER orders_prevent_facts_tampering;

COMMIT;


-- ---------------------------------------------------------------------
-- ETAPE 3 — Verification finale (a executer apres)
-- ---------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM auth.users)               AS comptes_restants,      -- attendu : 1
  (SELECT count(*) FROM public.shops)              AS boutiques_restantes,  -- attendu : 0
  (SELECT count(*) FROM public.products)           AS produits_restants,    -- attendu : 0
  (SELECT count(*) FROM public.orders)             AS commandes_restantes,  -- attendu : 0
  (SELECT count(*) FROM public.order_items)        AS articles_restants,    -- attendu : 0
  (SELECT count(*) FROM public.payments)           AS paiements_restants,   -- attendu : 0
  (SELECT count(*) FROM public.transaction_logs)   AS logs_restants,        -- attendu : 0
  (SELECT count(*) FROM public.contact_messages)   AS messages_restants,    -- attendu : 0
  (SELECT count(*) FROM public.subscription_plans) AS plans_conserves;      -- attendu : > 0, inchange

-- Verifie aussi que le trigger est bien reactive (doit afficher 'O' = origin/enabled) :
SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'orders_prevent_facts_tampering';
