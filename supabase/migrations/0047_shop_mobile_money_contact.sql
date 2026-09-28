-- ============================================================================
-- Numéro Mobile Money du vendeur — 29/09/2026.
--
-- Remplace le paiement en ligne des commandes via Nyole (construit puis
-- abandonné le jour même, voir claude/decisions-techniques.md pour le
-- détail) : Isaac a tranché que KEVA n'a pas à centraliser l'argent des
-- ventes vendeur ni à gérer des reversements manuels — "Keva n'a pas à
-- gérer ça [...] Shopify ne fait pas ça". Les vendeurs qui acceptent le
-- Mobile Money renseignent désormais leur PROPRE numéro sur leur fiche
-- boutique, affiché au client à titre purement informatif (comme
-- `whatsapp_number`, migration 0013) — le règlement se fait directement
-- entre le vendeur et le client, hors de tout parcours ou traitement KEVA :
-- aucune commande, aucun statut, aucun montant ne transite par ce champ.
--
-- Deux colonnes plutôt qu'une seule chaîne libre : `mobile_money_operator`
-- (une des 4 valeurs déjà utilisées ailleurs dans le projet pour désigner un
-- opérateur — voir l'ancien `vendor_withdrawal_requests.payout_method`,
-- retiré avec cette même marche arrière) permet d'afficher un libellé net
-- ("Wave : 07 00 00 00 00") plutôt qu'un texte libre mal formaté ; le
-- numéro lui-même reste une chaîne libre comme `whatsapp_number`, aucun
-- format de téléphone n'étant fiable à valider strictement selon le pays.
-- Les deux sont optionnels et indépendants de `whatsapp_number`.
-- ============================================================================

alter table shops add column if not exists mobile_money_number text;
alter table shops add column if not exists mobile_money_operator text
  check (mobile_money_operator in ('wave', 'orange_money', 'mtn_momo', 'moov'));
