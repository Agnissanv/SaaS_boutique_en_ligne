-- ============================================================================
-- Colonne manquante découverte en configurant le vrai compte CinetPay d'Isaac
-- (15/09/2026) : la doc "Notification de transaction" de son tableau de bord
-- (API "1.0 Aurora") recommande explicitement de comparer le `notify_token`
-- reçu dans le webhook avec celui renvoyé lors de l'initialisation du
-- paiement, pour authentifier la notification AVANT même d'aller vérifier le
-- statut réel via GET /v1/payment/{merchant_transaction_id} :
--
--   "Comparez le notify_token reçu dans le corps de la requête avec celui
--   renvoyé lors de l'initialisation du paiement. C'est votre garantie
--   d'authenticité."
--
-- Ce n'est PAS un remplacement de la vérification obligatoire via l'API
-- (qui reste la seule source de vérité sur le statut) — seulement une
-- vérification supplémentaire qui rejette immédiatement un appel forgé sur
-- une URL de webhook publique, avant de dépenser un appel API pour rien.
-- ============================================================================

alter table payments add column if not exists provider_notify_token text;
