-- ============================================================================
-- Réponse vendeur aux avis — tâche #78 du lot UX/fonctionnalités du
-- 21/09/2026 ("Bon, fais tout ce qui est faisable rapidement... qui ne
-- dépend pas de moyens de paiement"), à la suite du badge "achat vérifié"
-- (#77) sur les mêmes avis.
--
-- Choix : deux colonnes simples sur `product_reviews` plutôt qu'une table
-- séparée — un seul réponse possible par avis (pas un fil de discussion),
-- même logique que `tags text[]` sur `products` en 0011 : pas de complexité
-- superflue pour un besoin à une seule valeur.
-- ============================================================================

alter table product_reviews add column if not exists seller_reply text
  check (seller_reply is null or char_length(seller_reply) <= 500);
alter table product_reviews add column if not exists seller_reply_at timestamptz;

-- Écriture exclusivement via cette fonction security definer, même principe
-- que `submit_product_review` (0011) : aucune policy update n'est ajoutée
-- sur `product_reviews`, donc même un vendeur authentifié ne peut toucher
-- directement la table — seule cette fonction vérifie qu'il est bien
-- propriétaire de la boutique du produit concerné avant d'écrire, et
-- UNIQUEMENT les deux colonnes de réponse (rating/comment/customer_name du
-- client restent hors de portée, cf. "avis non modifiable par le vendeur").
--
-- `p_reply` vide ou nul efface la réponse (le vendeur peut revenir supprimer
-- ou modifier ce qu'il a écrit) plutôt que d'exiger une fonction séparée.
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
  v_owns boolean;
begin
  if v_reply is not null and char_length(v_reply) > 500 then
    raise exception 'La réponse ne peut pas dépasser 500 caractères';
  end if;

  select exists (
    select 1
    from product_reviews pr
    join products p on p.id = pr.product_id
    join shops s on s.id = p.shop_id
    where pr.id = p_review_id and s.owner_id = auth.uid()
  ) into v_owns;

  if not v_owns then
    raise exception 'Cet avis ne concerne pas une de tes boutiques';
  end if;

  update product_reviews
  set seller_reply = v_reply,
      seller_reply_at = case when v_reply is null then null else now() end
  where id = p_review_id;
end;
$$;

grant execute on function public.reply_to_product_review(uuid, text) to authenticated;
