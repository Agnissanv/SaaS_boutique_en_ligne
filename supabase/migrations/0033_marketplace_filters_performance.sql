-- ============================================================================
-- Optimisations de scalabilité (22/09/2026) — Isaac a posé la question avant
-- lancement : "est-ce que la V1 peut accueillir 1000 ou 2000 vendeurs ?".
-- Deux points concrets identifiés en auditant les requêtes existantes, tous
-- deux déjà annoncés en commentaire au moment où ils ont été écrits ("à
-- revoir si le catalogue grossit significativement") — Isaac a confirmé
-- viser ce volume, donc traités maintenant plutôt que d'attendre de
-- constater la lenteur en production.
--
-- 1. Index manquant sur `products.category` (combiné à `is_active`/
--    `deleted_at`) : utilisé par TOUS les filtres de catégorie de la
--    plateforme (page d'accueil marketplace, page boutique, panneau de
--    filtres du 22/09/2026), sans aucun index dédié jusqu'ici (seul
--    `products_shop_id_idx`, 0001_init.sql, existait). À 1000-2000 boutiques
--    (~20-50 produits chacune), ça représente 20 000 à 100 000 lignes
--    potentiellement scannées séquentiellement à chaque filtre par
--    catégorie. Index PARTIEL (uniquement sur les produits actifs non
--    supprimés — la seule condition qui compte pour toutes les requêtes
--    publiques) plutôt qu'un index plein sur toute la table : plus petit,
--    plus rapide à maintenir, et couvre exactement ce qui est réellement
--    filtré.
--
-- 2. `availableCategoriesQuery` (src/app/page.tsx) relisait la catégorie de
--    TOUS les produits actifs de la plateforme à CHAQUE chargement de la
--    page d'accueil marketplace, pour en déduire en JS lesquelles ont au
--    moins un produit. Annoncé "acceptable au volume actuel, à revoir avec
--    une RPC dédiée (distinct + count) si le catalogue grossit
--    significativement" au moment de son écriture (16/09/2026, voir
--    decisions-techniques.md). Contrairement aux autres flux de la page
--    (bandes par catégorie, meilleures ventes...), volontairement plafonnés,
--    celui-ci grossissait directement avec le nombre de vendeurs — le
--    premier vrai goulot d'étranglement identifié à ce volume. Remplacé par
--    une RPC qui fait le DISTINCT directement en base : Postgres ne renvoie
--    alors qu'une poignée de lignes (une par catégorie réellement utilisée,
--    au plus 24), jamais une par produit.
--
--    `security invoker` (PAS `security definer`, contrairement à
--    `get_best_selling_products` en 0015) : cette RPC ne lit rien que la
--    policy RLS publique existante (`products_public_read_active`,
--    `shops_public_read_active`) n'autorise déjà à un visiteur anonyme — pas
--    besoin de contourner RLS ici, juste d'éviter de rapatrier une ligne par
--    produit pour ne garder que la colonne catégorie.
-- ============================================================================

create index if not exists products_active_category_idx
  on products (category)
  where is_active = true and deleted_at is null;

-- Catégories disponibles sur la marketplace globale (remplace la lecture
-- complète faite jusqu'ici dans `src/app/page.tsx`).
create or replace function public.get_available_categories()
returns table (category text)
language sql
stable
as $$
  select distinct p.category
  from products p
  join shops s on s.id = p.shop_id
  where p.is_active = true
    and p.deleted_at is null
    and s.status = 'active'
    and p.category is not null;
$$;

grant execute on function public.get_available_categories() to anon, authenticated;

-- Même besoin, scopé à une seule boutique — remplace la requête équivalente
-- de la page boutique publique (`src/app/(public)/[shopSlug]/page.tsx`,
-- `shopCategoriesRaw`), qui relisait elle aussi la catégorie de chaque
-- produit de la boutique plutôt qu'un DISTINCT en base. Moins critique à ce
-- volume (le catalogue d'UNE seule boutique reste raisonnable même à 1000-
-- 2000 vendeurs), mais corrigé au passage pour rester cohérent entre les
-- deux pages plutôt que d'optimiser une seule des deux.
create or replace function public.get_shop_available_categories(p_shop_id uuid)
returns table (category text)
language sql
stable
as $$
  select distinct p.category
  from products p
  where p.shop_id = p_shop_id
    and p.is_active = true
    and p.deleted_at is null
    and p.category is not null;
$$;

grant execute on function public.get_shop_available_categories(uuid) to anon, authenticated;
