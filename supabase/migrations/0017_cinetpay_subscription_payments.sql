-- ============================================================================
-- Paiement CinetPay réel pour les abonnements (15/09/2026) — Isaac a confirmé
-- que le compte marchand CinetPay est maintenant validé (voir
-- decisions-techniques.md, ce compte était en attente depuis le 13/09/2026).
--
-- `payments` (0001_init.sql) a déjà tout ce qu'il faut pour enregistrer une
-- tentative de paiement (shop_id, provider_transaction_id, amount, status,
-- raw_payload) SAUF un moyen de retrouver QUEL plan cette tentative doit
-- activer une fois le paiement confirmé — le webhook ne doit jamais faire
-- confiance à un champ du payload CinetPay pour ça (voir
-- src/app/api/cinetpay/webhook/route.ts), donc cette intention est stockée
-- dans NOTRE base au moment de l'initialisation, avant même d'afficher le
-- guichet de paiement au vendeur (recommandation officielle CinetPay).
-- ============================================================================

alter table payments add column if not exists intent_plan_code text;

-- Un `transaction_id` CinetPay doit être unique par tentative (leur doc :
-- "chaque modification de paramètre nécessite un nouveau transaction_id") —
-- l'unicité en base empêche un doublon accidentel de fausser la recherche du
-- paiement correspondant à la réception du webhook.
create unique index if not exists payments_provider_transaction_id_idx
  on payments (provider_transaction_id)
  where provider_transaction_id is not null;
