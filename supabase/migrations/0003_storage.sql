-- ============================================================================
-- Supabase Storage : bucket unique pour les images boutique + produits
--
-- Convention de chemin — premier segment = auth.uid() du vendeur, PAS l'id
-- de la boutique/du produit. Volontaire : au moment où le vendeur choisit un
-- logo, la boutique n'existe pas encore en base (elle est créée par la même
-- soumission de formulaire), donc son id n'est pas encore disponible. Le
-- user id, lui, existe dès la connexion.
--   {auth.uid()}/shop/logo/<fichier>
--   {auth.uid()}/shop/cover/<fichier>
--   {auth.uid()}/products/<uuid-quelconque>/<fichier>
--
-- Bucket "public" : les fichiers sont servables via une URL publique directe
-- (`getPublicUrl`) sans vérifier les policies RLS ci-dessous — logique pour
-- une boutique en ligne où les images doivent être visibles par tout le
-- monde. Les policies ne s'appliquent qu'aux opérations d'écriture
-- (upload/update/delete) et à la lecture via l'API de gestion (`.list()`).
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('shop-assets', 'shop-assets', true)
on conflict (id) do nothing;

-- Lecture publique (y compris via l'API de gestion, pas seulement les URLs publiques)
create policy "shop_assets_public_read"
on storage.objects for select
using (bucket_id = 'shop-assets');

-- Upload : uniquement dans son propre dossier (premier segment = son user id)
create policy "shop_assets_owner_insert"
on storage.objects for insert
with check (
  bucket_id = 'shop-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Remplacement (upsert) : idem
create policy "shop_assets_owner_update"
on storage.objects for update
using (
  bucket_id = 'shop-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'shop-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Suppression : idem (retrait d'une photo, remplacement du logo...)
create policy "shop_assets_owner_delete"
on storage.objects for delete
using (
  bucket_id = 'shop-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);
