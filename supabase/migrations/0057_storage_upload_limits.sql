-- ============================================================================
-- Bucket `shop-assets` : taille et types de fichiers limités côté serveur
-- — 09/10/2026 (audit de sécurité, point 9).
--
-- Problème : le bucket (0003) est public, sans limite de taille ni de type.
-- Les contrôles « c'est bien une image, 5 Mo max » n'existaient que dans le
-- navigateur (src/lib/supabase/storage.ts), donc contournables par un appel
-- direct à l'API Storage. N'importe quel compte connecté pouvait déposer dans
-- son dossier un fichier quelconque — SVG ou HTML contenant du script, servi
-- ensuite publiquement depuis le domaine Supabase, ou des fichiers lourds aux
-- frais de KEVA.
--
-- Correctif : limites appliquées par Supabase Storage lui-même.
--   - 5 Mo maximum : même valeur que MAX_OUTPUT_SIZE_MB côté navigateur (les
--     photos sont recompressées en WebP avant envoi) ;
--   - types autorisés : JPEG, PNG, WebP, GIF, AVIF. Pas de SVG (peut contenir
--     du script) ni de HEIC (non affichable par la plupart des navigateurs ;
--     le navigateur le convertit désormais en WebP avant l'envoi).
-- Les fichiers déjà présents ne sont pas touchés.
-- ============================================================================

update storage.buckets
set
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
where id = 'shop-assets';
