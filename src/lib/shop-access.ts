import { createClient } from "@/lib/supabase/server";

export type ShopAccess = {
  shopId: string;
  /**
   * `false` pour un collaborateur (plan Pro, `can_multi_user`, ajouté le
   * 16/09/2026, voir migration 0024_shop_collaborators.sql) — utilisé pour
   * masquer/interdire les pages réservées au propriétaire (réglages
   * boutique, abonnement, paiements, codes promo, gestion des
   * collaborateurs eux-mêmes).
   */
  isOwner: boolean;
};

/**
 * Résout la boutique que l'utilisateur connecté peut utiliser : la sienne
 * s'il en est propriétaire, sinon celle où il est collaborateur actif. Un
 * seul point de résolution, réutilisé partout où `shops.owner_id =
 * auth.uid()` suffisait jusqu'ici pour trouver "sa" boutique (produits,
 * commandes, aperçu) — voir decisions-techniques.md pour le périmètre exact
 * de ce qu'un collaborateur peut faire.
 *
 * Ne remplace PAS les pages réservées au propriétaire (boutique, abonnement,
 * paiements, codes-promo, collaborateurs), qui continuent d'utiliser un
 * lookup `owner_id` direct — un collaborateur n'y a délibérément aucun accès.
 */
export async function getAccessibleShop(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<ShopAccess | null> {
  const { data: owned } = await supabase
    .from("shops")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();

  if (owned) {
    return { shopId: owned.id, isOwner: true };
  }

  const { data: collab } = await supabase
    .from("shop_collaborators")
    .select("shop_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (collab) {
    return { shopId: collab.shop_id, isOwner: false };
  }

  return null;
}
