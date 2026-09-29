-- ============================================================================
-- Verrou d'idempotence sur les commissions commerciales (30/09/2026, audit
-- technique complet demandé par Isaac).
--
-- Bug trouvé : contrairement à `referrals`/`maybeGrantReferralReward`
-- (migration 0045, verrou atomique via `rewarded_at is null`),
-- `commercial_commission_events`/`maybeCreditCommercialCommission`
-- (migration 0046) n'avait AUCUN verrou — le commentaire d'origine du fichier
-- justifiait ça par "le webhook Nyole vérifie déjà payment.status ===
-- 'success' avant d'appeler cette fonction". Faux en pratique : dans
-- api/nyole/webhook/route.ts, ce check lit `payments.status` puis, bien plus
-- bas, le webhook le POSE à 'success' — deux étapes séparées, pas une
-- opération atomique. Nyole retente un même événement jusqu'à 10 fois sur
-- ~72h ; si deux livraisons arrivent assez proches l'une de l'autre, les DEUX
-- peuvent lire `status !== 'success'` avant que la première ait fini d'écrire,
-- et donc créditer DEUX FOIS la même commission réelle (argent qu'Isaac doit
-- à son commercial). `maybeGrantReferralReward` était protégée par son propre
-- verrou pour exactement ce scénario ; `maybeCreditCommercialCommission` ne
-- l'était pas.
--
-- Correctif : chaque ligne de commission créée depuis le webhook référence
-- désormais le paiement exact qui l'a déclenchée (`payment_id`), avec une
-- contrainte unique PARTIELLE (uniquement quand `payment_id is not null`) —
-- un même paiement ne peut donc plus jamais créer deux lignes de commission,
-- quel que soit le nombre de fois où le webhook est rejoué. `payment_id` reste
-- nullable : l'assignation manuelle admin (`admin/abonnements/actions.ts`,
-- encaissement hors-app, pas de ligne `payments`) continue de créditer sans
-- référence de paiement, exactement comme avant — un geste manuel unique par
-- clic admin n'a jamais eu ce risque de double-livraison.
-- ============================================================================

alter table commercial_commission_events
  add column if not exists payment_id uuid references payments (id) on delete set null;

create unique index if not exists commercial_commission_events_payment_id_key
  on commercial_commission_events (payment_id)
  where payment_id is not null;
