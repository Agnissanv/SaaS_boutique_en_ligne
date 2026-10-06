-- ============================================================================
-- Paiement en ligne des COMMANDES clients + portefeuille vendeur — 29/09/2026,
-- suite directe de la bascule Nyole (voir claude/decisions-techniques.md,
-- section "Essai à blanc..." du 29/09/2026). Jusqu'ici, `orders.payment_method`
-- acceptait déjà 'mobile_money' en base (0001_init.sql) mais l'option était
-- désactivée côté UI ("bientôt disponible") faute d'agrégateur branché sur le
-- checkout — seul `cash_on_delivery` fonctionnait réellement.
--
-- Décisions tranchées avec Isaac (AskUserQuestion, 29/09/2026) avant d'écrire
-- quoi que ce soit :
-- - Nyole encaisse sur UN SEUL compte (le sien) — voir doc "Solde et
--   reversements" : "Le numéro de réception vous appartient... un numéro au
--   nom d'un tiers fait refuser la demande." Impossible donc de reverser
--   automatiquement à chaque vendeur. Isaac a choisi : centraliser sur son
--   compte Nyole, MAIS suivre automatiquement ce qui est dû à chaque
--   vendeur (au lieu d'un calcul manuel), et laisser le vendeur déclencher
--   une DEMANDE de retrait depuis son dashboard — Isaac reste celui qui
--   exécute le virement réel (Wave/Orange Money/etc.) et marque la demande
--   comme payée, exactement le même modèle que les commissions commerciales
--   (migration 0046) : ledger d'événements + pointage manuel, jamais un
--   virement automatique.
-- - KEVA ne prélève AUCUNE commission supplémentaire sur ces ventes ("il
--   garde ses marges", mots d'Isaac) : le vendeur est crédité du montant
--   total de la commande.
-- - La commission Nyole elle-même (5% par défaut, non transférable au
--   client d'après leur propre doc "Commission et frais" — seuls les frais
--   de passerelle le sont, un réglage de compte, pas une option API) est
--   absorbée par un montant facturé légèrement majoré au CLIENT plutôt que
--   par le vendeur — voir `grossUpAmountForNyoleCommission` dans
--   src/lib/nyole.ts, déjà appliquée aux abonnements pour la même raison.
--   Le vendeur est donc crédité du prix affiché en INTÉGRALITÉ.
-- - Retrait minimum : 1000 FCFA (choix d'Isaac, pour éviter des demandes de
--   quelques centaines de FCFA qui lui feraient faire un virement pour
--   presque rien) — voir `MIN_WITHDRAWAL_AMOUNT` dans src/lib/vendor-wallet.ts,
--   revérifié ici côté serveur dans `request_vendor_withdrawal` (jamais une
--   règle uniquement côté client).
--
-- Ni le paiement en ligne des commandes ni ce portefeuille ne restaurent le
-- stock en cas d'échec/annulation du paiement — délibéré, pour rester
-- cohérent avec `cancel_order` (migration 0030) qui ne restaure déjà jamais
-- le stock d'une commande annulée : ce projet n'a jamais eu de mécanique de
-- "réservation de stock" séparée de la décrémentation à la création, un
-- changement de comportement uniquement pour ce cas précis créerait une
-- incohérence, pas une amélioration.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) vendor_wallet_entries — ledger d'événements (jamais un solde stocké en
--    place, même principe que commercial_commission_events) : chaque paiement
--    de commande en ligne confirmé crée une ligne de crédit, chaque demande de
--    retrait crée immédiatement une ligne de débit (réservant le montant tout
--    de suite, pas seulement au moment où Isaac paie effectivement — voir
--    `request_vendor_withdrawal` plus bas), un rejet admin crée une ligne de
--    remboursement. Le solde disponible = somme des lignes, jamais recalculé
--    ni stocké ailleurs — une seule source de vérité.
-- ----------------------------------------------------------------------------
create table if not exists vendor_wallet_entries (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  order_id uuid references orders (id) on delete set null,
  withdrawal_request_id uuid, -- FK ajoutée après création de vendor_withdrawal_requests, plus bas
  kind text not null check (kind in ('order_payment_credit', 'withdrawal_debit', 'withdrawal_reversal')),
  amount numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  -- Garde-fou de cohérence : un crédit est toujours positif, un débit de
  -- retrait toujours négatif, un remboursement de retrait rejeté toujours
  -- positif — empêche une ligne mal signée d'entrer silencieusement.
  constraint vendor_wallet_entries_sign_check check (
    (kind = 'order_payment_credit' and amount > 0) or
    (kind = 'withdrawal_debit' and amount < 0) or
    (kind = 'withdrawal_reversal' and amount > 0)
  )
);

create index if not exists vendor_wallet_entries_shop_id_idx on vendor_wallet_entries (shop_id);

alter table vendor_wallet_entries enable row level security;

-- Lecture seule pour le vendeur (propriétaire de la boutique) et l'admin —
-- aucune policy d'écriture cliente : les crédits viennent du webhook Nyole
-- (client service role, contourne RLS), les débits/remboursements de la RPC
-- `request_vendor_withdrawal` (security definer, ci-dessous) ou d'une action
-- admin authentifiée (couverte par la policy admin "for all").
create policy "vendor_wallet_entries_owner_read" on vendor_wallet_entries for select using (
  exists (select 1 from shops where shops.id = vendor_wallet_entries.shop_id and shops.owner_id = auth.uid())
);
create policy "vendor_wallet_entries_admin_all" on vendor_wallet_entries for all using (
  is_admin()
) with check (is_admin());

-- ----------------------------------------------------------------------------
-- 2) vendor_withdrawal_requests — une ligne par demande de retrait vendeur.
--    'paid'/'rejected' posés uniquement par un admin (voir admin/retraits/).
-- ----------------------------------------------------------------------------
create table if not exists vendor_withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  payout_phone text not null,
  payout_method text not null check (payout_method in ('wave', 'orange_money', 'mtn_momo', 'moov')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'rejected')),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references profiles (id) on delete set null,
  admin_note text
);

create index if not exists vendor_withdrawal_requests_shop_id_idx on vendor_withdrawal_requests (shop_id);
create index if not exists vendor_withdrawal_requests_status_idx on vendor_withdrawal_requests (status);

alter table vendor_withdrawal_requests enable row level security;

create policy "vendor_withdrawal_requests_owner_read" on vendor_withdrawal_requests for select using (
  exists (select 1 from shops where shops.id = vendor_withdrawal_requests.shop_id and shops.owner_id = auth.uid())
);
create policy "vendor_withdrawal_requests_admin_all" on vendor_withdrawal_requests for all using (
  is_admin()
) with check (is_admin());

alter table vendor_wallet_entries
  add constraint vendor_wallet_entries_withdrawal_request_id_fkey
  foreign key (withdrawal_request_id) references vendor_withdrawal_requests (id) on delete set null;

-- ----------------------------------------------------------------------------
-- 3) request_vendor_withdrawal — seul chemin d'écriture client pour créer une
--    demande de retrait. Verrouille la ligne `shops` du vendeur (`for update`)
--    le temps de vérifier le solde ET d'insérer le débit, pour qu'un double clic
--    ou deux onglets ouverts ne puissent jamais faire passer deux demandes qui,
--    prises séparément, tiennent chacune dans le solde mais pas ensemble.
-- ----------------------------------------------------------------------------
create or replace function public.request_vendor_withdrawal(
  p_shop_id uuid,
  p_amount numeric,
  p_payout_phone text,
  p_payout_method text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_balance numeric;
  v_request_id uuid;
begin
  select owner_id into v_owner_id from shops where id = p_shop_id for update;

  if v_owner_id is null then
    raise exception 'Boutique introuvable';
  end if;

  if v_owner_id <> auth.uid() then
    raise exception 'Accès refusé';
  end if;

  if p_payout_method not in ('wave', 'orange_money', 'mtn_momo', 'moov') then
    raise exception 'Moyen de réception invalide';
  end if;

  if coalesce(trim(p_payout_phone), '') = '' then
    raise exception 'Numéro de réception requis';
  end if;

  -- Minimum choisi par Isaac (29/09/2026) — voir MIN_WITHDRAWAL_AMOUNT dans
  -- src/lib/vendor-wallet.ts, dupliqué ici volontairement (défense en
  -- profondeur : cette RPC est le vrai gardien, pas le formulaire).
  if p_amount is null or p_amount < 1000 then
    raise exception 'Le retrait minimum est de 1000 FCFA';
  end if;

  select coalesce(sum(amount), 0) into v_balance
    from vendor_wallet_entries
    where shop_id = p_shop_id;

  if p_amount > v_balance then
    raise exception 'Solde insuffisant pour ce retrait';
  end if;

  insert into vendor_withdrawal_requests (shop_id, amount, payout_phone, payout_method)
  values (p_shop_id, p_amount, trim(p_payout_phone), p_payout_method)
  returning id into v_request_id;

  -- Débit immédiat (pas seulement au moment où Isaac paie réellement) : le
  -- solde affiché au vendeur reflète tout de suite "ce qu'il reste après
  -- cette demande", empêchant de redemander le même argent avant que la
  -- première demande soit traitée.
  insert into vendor_wallet_entries (shop_id, withdrawal_request_id, kind, amount)
  values (p_shop_id, v_request_id, 'withdrawal_debit', -p_amount);

  return v_request_id;
end;
$$;

grant execute on function public.request_vendor_withdrawal(uuid, numeric, text, text) to authenticated;
