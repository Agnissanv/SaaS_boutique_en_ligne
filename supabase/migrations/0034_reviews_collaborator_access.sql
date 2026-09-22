-- ============================================================================
-- Correction d'un vrai bug trouvé lors de l'audit pré-lancement du
-- 22/09/2026 : la page "Avis" du dashboard vendeur (dashboard/avis/) est
-- affichée dans la barre latérale à TOUT utilisateur ayant accès au
-- dashboard — pas marquée `ownerOnly` (voir sidebar-nav.tsx), contrairement
-- à "Ma boutique"/"Abonnement"/etc. — cohérent avec le fait qu'un
-- collaborateur (plan Pro, migration 0024) est censé pouvoir consulter et
-- répondre aux avis au même titre que les produits/commandes.
--
-- Sauf que ni la lecture (`product_reviews_owner_read`, 0013) ni l'écriture
-- (`reply_to_product_review`, 0028) n'ont jamais été étendues aux
-- collaborateurs — les deux ne vérifient que `shops.owner_id = auth.uid()`.
-- Un collaborateur qui clique "Avis" tombe donc sur une page vide (RLS
-- masque silencieusement tous les avis) et une réponse échouerait avec
-- "Cet avis ne concerne pas une de tes boutiques" si jamais il en voyait un.
--
-- Fix : même traitement que products/orders en 0024 — une policy de lecture
-- ADDITIONNELLE pour `product_reviews` (jamais de modification de la policy
-- `_owner_read` existante, Postgres combine les policies permissives en OR),
-- et `reply_to_product_review` mis à jour pour accepter un collaborateur
-- actif en plus du propriétaire, via `is_shop_collaborator` (0024) —
-- qui gère déjà lui-même le cas d'un downgrade retirant l'accès.
-- ============================================================================

create policy "product_reviews_collaborator_read" on product_reviews for select using (
  exists (
    select 1 from products
    where products.id = product_reviews.product_id
      and public.is_shop_collaborator(products.shop_id)
  )
);

create or replace function public.reply_to_product_review(
  p_review_id uuid,
  p_reply text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reply text := nullif(trim(coalesce(p_reply, '')), '');
  v_allowed boolean;
begin
  if v_reply is not null and char_length(v_reply) > 500 then
    raise exception 'La réponse ne peut pas dépasser 500 caractères';
  end if;

  select exists (
    select 1
    from product_reviews pr
    join products p on p.id = pr.product_id
    join shops s on s.id = p.shop_id
    where pr.id = p_review_id
      and (s.owner_id = auth.uid() or public.is_shop_collaborator(p.shop_id))
  ) into v_allowed;

  if not v_allowed then
    raise exception 'Cet avis ne concerne pas une de tes boutiques';
  end if;

  update product_reviews
  set seller_reply = v_reply,
      seller_reply_at = case when v_reply is null then null else now() end
  where id = p_review_id;
end;
$$;
