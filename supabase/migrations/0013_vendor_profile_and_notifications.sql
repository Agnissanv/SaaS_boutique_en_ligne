-- ============================================================================
-- Profil vendeur / contact WhatsApp boutique / notification email nouvelle
-- commande / lecture des avis par le vendeur propriétaire (15/09/2026)
--
-- Contexte : suite au mandat large d'Isaac le 15/09/2026 ("tout ce que tu as
-- cité... sauf ce qui dépend encore des moyens de paiement... même ce que tu
-- n'as pas cité, ce qui est vraiment essentiel, ajoute ça"), en réponse à
-- l'analyse des manques du dashboard vendeur. Voir claude/decisions-
-- techniques.md, section "Batch dashboard vendeur du 15/09/2026", pour le
-- détail de chaque fonctionnalité construite à partir de cette migration.
--
-- Rien ici ne touche à l'intégration CinetPay/Mobile Money, explicitement
-- hors scope de ce mandat.
-- ============================================================================

-- 1. Contact WhatsApp direct de la boutique. Jusqu'ici aucune colonne ne
--    permettait à un client de contacter le vendeur autrement qu'en
--    commandant directement — alors que le cahier des charges (§2.1) cible
--    précisément des vendeurs qui vivent sur WhatsApp/Instagram. Optionnel :
--    un vendeur qui ne veut pas être contacté hors commande laisse vide, le
--    bouton "Contacter sur WhatsApp" n'apparaît alors simplement pas.
alter table shops add column if not exists whatsapp_number text;

-- 2. Email de notification "nouvelle commande" — volontairement distinct de
--    l'email de connexion (auth.users.email) : permet de recevoir les
--    notifications sur une autre adresse (ex. partagée par plusieurs
--    employés d'une même boutique) sans toucher aux identifiants de
--    connexion. Null = comportement actuel inchangé (aucun email envoyé).
alter table shops add column if not exists notification_email text;

-- 3. Lecture des avis par le vendeur propriétaire, y compris pour un produit
--    désactivé ou une boutique suspendue. La policy `product_reviews_public_read`
--    (migration 0011) exige produit actif + boutique active : correcte pour
--    la lecture PUBLIQUE, mais elle cachait par effet de bord ses propres
--    avis au vendeur dès qu'il désactive temporairement un produit — aucune
--    page vendeur ne les lisait jusqu'ici de toute façon (nouvelle page
--    /dashboard/avis). Policy séparée plutôt que modifier l'existante : les
--    deux policies "for select" se combinent en OR (comportement standard de
--    Postgres RLS), donc la lecture publique reste inchangée.
create policy "product_reviews_owner_read" on product_reviews for select using (
  exists (
    select 1
    from products
    join shops on shops.id = products.shop_id
    where products.id = product_reviews.product_id and shops.owner_id = auth.uid()
  )
);

-- 4. `get_order_notification_info` : information minimale nécessaire pour
--    prévenir le vendeur par email qu'une nouvelle commande vient d'arriver.
--    Appelée côté client juste après `create_order` (voir cart-checkout.tsx),
--    donc SANS session vendeur authentifiée — sécurisée par le même modèle
--    de "jeton de capacité" que `get_order_receipt` : l'UUID de commande
--    vient tout juste d'être généré côté serveur et n'est connu que du
--    client qui vient de commander. Ne renvoie que ce que l'email affiche —
--    aucune donnée client superflue (pas de téléphone, pas d'adresse).
--    `order_url_path` pointe vers la page de gestion vendeur de la commande
--    (pas la page de confirmation client) : c'est là que le vendeur agit.
create or replace function public.get_order_notification_info(p_order_id uuid)
returns table (
  shop_name text,
  notification_email text,
  customer_name text,
  total_amount numeric,
  order_url_path text
)
language sql
security definer
set search_path = public
stable
as $$
  select s.name, s.notification_email, o.customer_name, o.total_amount,
         '/dashboard/commandes/' || o.id::text
  from orders o
  join shops s on s.id = o.shop_id
  where o.id = p_order_id;
$$;

grant execute on function public.get_order_notification_info(uuid) to anon, authenticated;
