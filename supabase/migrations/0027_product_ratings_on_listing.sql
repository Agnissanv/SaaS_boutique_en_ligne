-- ============================================================================
-- Note/nombre d'avis visible dès la liste de produits (16/09/2026) — les avis
-- existaient déjà (migration 0011) mais n'étaient affichés qu'une fois sur la
-- fiche produit elle-même (`product_reviews`, filtré par `product_id`) ou
-- agrégés au niveau boutique (`getShopRating`, `src/lib/reviews.ts`). Or
-- c'est justement au moment de parcourir/choisir (marketplace, page
-- boutique) que la preuve sociale influence le plus le clic — la donnée
-- existait déjà, elle manquait seulement à l'endroit où elle sert le plus.
--
-- RPC dédiée plutôt qu'une requête `product_reviews` par produit affiché :
-- la page d'accueil marketplace peut afficher plusieurs dizaines de produits
-- à la fois (nouveautés + meilleures ventes + une bande par catégorie), donc
-- un vrai batch (un tableau d'ids, une seule requête groupée) plutôt qu'un
-- fan-out d'appels comme `getShopRating` (acceptable là où le nombre de
-- boutiques affichées est plafonné à `FEATURED_SHOPS_SIZE`, pas ici).
--
-- Mode par défaut ("security invoker", PAS "security definer") — même
-- raisonnement que `get_shop_best_sellers`/`get_shop_category_breakdown`
-- (migrations 0025/0026) : la policy RLS publique existante
-- (`product_reviews_public_read`, migration 0011, qui filtre déjà par
-- produit actif ET boutique active) s'applique normalement à l'intérieur de
-- la fonction. Un id de produit inactif/supprimé passé dans `p_product_ids`
-- ne renvoie donc simplement aucune ligne, sans logique de filtrage
-- dupliquée ici. Appelée depuis la marketplace et la page boutique, toutes
-- deux publiques/anonymes — grant explicite à `anon` (comme
-- `get_best_selling_products`, migration 0015).
-- ============================================================================

create or replace function public.get_products_ratings(p_product_ids uuid[])
returns table (product_id uuid, average numeric, review_count bigint)
language sql
stable
as $$
  select
    product_id,
    avg(rating)::numeric as average,
    count(*)::bigint as review_count
  from product_reviews
  where product_id = any(p_product_ids)
  group by product_id;
$$;

grant execute on function public.get_products_ratings(uuid[]) to anon, authenticated;
