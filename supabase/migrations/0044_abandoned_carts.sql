-- ============================================================================
-- Paniers abandonnés — relance MANUELLE par le vendeur, 23/09/2026.
--
-- Suite de l'audit croissance. Une vraie relance automatique par email (voir
-- decisions-techniques.md, section "Restent à construire") a été écartée :
-- capturer l'email avant validation puis un cron d'envoi consommerait le
-- quota Brevo partagé par toute la plateforme, et ce marché reste
-- WhatsApp-first (peu de clients renseignent un email, il est optionnel au
-- tunnel de commande). Isaac a tranché : "si ça peut être de façon manuelle
-- pour le vendeur, pas dans notre quota de Brevo, ça sera parfait" — donc
-- PAS d'email, PAS d'envoi automatique. KEVA se contente de capturer le
-- signal et d'afficher au vendeur un bouton WhatsApp pré-rempli ; c'est LUI
-- qui décide d'écrire, quand il veut, à qui il veut. Zéro coût, zéro envoi
-- fait "au nom de KEVA".
--
-- Signal capturé : dès qu'un client atteint l'étape "commande" du panier
-- (cart-checkout.tsx) et remplit un nom + un téléphone qui ressemble à un
-- vrai numéro, un appel silencieux (debounce ~1.5s, jamais visible côté
-- client, jamais bloquant) enregistre/actualise une ligne ici. Si la
-- commande aboutit, la ligne est supprimée aussitôt (`clear_abandoned_cart`,
-- appelé juste après `create_order` réussi) : "abandonné" ne veut dire que
-- "n'a jamais confirmé sa commande depuis". Avant ce chantier, fermer
-- l'onglet à cette étape ne laissait absolument aucune trace nulle part
-- (confirmé en lisant le code avant de construire quoi que ce soit) : le
-- vendeur ne savait même pas qu'un client avait été à deux doigts d'acheter.
--
-- Une ligne par (boutique, téléphone) — upsert, pas d'accumulation de lignes
-- à chaque frappe : le contenu du panier au moment du dernier appel écrase
-- le précédent.
-- ============================================================================

create table if not exists abandoned_carts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  customer_phone text not null,
  customer_name text not null,
  cart_snapshot jsonb not null,
  cart_total integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, customer_phone)
);

create index if not exists abandoned_carts_shop_id_updated_at_idx
  on abandoned_carts (shop_id, updated_at desc);

alter table abandoned_carts enable row level security;

-- Lecture : propriétaire ou collaborateur actif — même schéma que `orders`
-- et `shop_page_views` (migrations 0001/0024/0043). Aucune policy
-- d'insertion/suppression cliente : les deux fonctions `security definer`
-- ci-dessous sont le seul chemin d'écriture, même principe que
-- `increment_shop_view`/`create_order`.
create policy "abandoned_carts_owner_read" on abandoned_carts for select using (
  exists (select 1 from shops where shops.id = abandoned_carts.shop_id and shops.owner_id = auth.uid())
);
create policy "abandoned_carts_collaborator_read" on abandoned_carts for select using (
  is_shop_collaborator(shop_id)
);

-- `p_customer_phone` normalisé (chiffres uniquement, comme `toWhatsappNumber`
-- côté TS) et grossièrement validé (8 à 15 chiffres) AVANT d'être utilisé
-- comme clé d'upsert — un appel depuis un client anonyme ne doit jamais
-- pouvoir écrire une ligne inexploitable (numéro vide, garbage). Une entrée
-- invalide ou un panier vide ne fait rien (pas d'erreur levée : cet appel
-- est best-effort et silencieux côté client, une exception ferait planter
-- inutilement un `.catch()` qui n'affiche jamais rien à l'utilisateur).
create or replace function public.save_abandoned_cart(
  p_shop_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_cart_snapshot jsonb,
  p_cart_total integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := regexp_replace(coalesce(p_customer_phone, ''), '[^0-9]', '', 'g');
  v_name text := left(trim(coalesce(p_customer_name, '')), 200);
begin
  if length(v_phone) < 8 or length(v_phone) > 15 or v_name = '' or jsonb_array_length(coalesce(p_cart_snapshot, '[]'::jsonb)) = 0 then
    return;
  end if;

  insert into abandoned_carts (shop_id, customer_phone, customer_name, cart_snapshot, cart_total, updated_at)
  values (p_shop_id, v_phone, v_name, p_cart_snapshot, coalesce(p_cart_total, 0), now())
  on conflict (shop_id, customer_phone) do update
    set customer_name = excluded.customer_name,
        cart_snapshot = excluded.cart_snapshot,
        cart_total = excluded.cart_total,
        updated_at = now();
end;
$$;

grant execute on function public.save_abandoned_cart(uuid, text, text, jsonb, integer) to anon, authenticated;

-- Appelée juste après une commande réussie (voir cart-checkout.tsx) : le
-- panier n'est plus "abandonné", il a été confirmé.
create or replace function public.clear_abandoned_cart(p_shop_id uuid, p_customer_phone text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from abandoned_carts
  where shop_id = p_shop_id
    and customer_phone = regexp_replace(coalesce(p_customer_phone, ''), '[^0-9]', '', 'g');
$$;

grant execute on function public.clear_abandoned_cart(uuid, text) to anon, authenticated;
