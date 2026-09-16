import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getShopSubscription } from "@/lib/subscription";
import { CollaboratorList } from "./collaborator-list";
import { InviteForm } from "./invite-form";

export type Collaborator = {
  id: string;
  invited_email: string;
  status: "pending" | "active";
  invited_at: string;
};

/**
 * Gestion des collaborateurs — plan Pro (`can_multi_user`), ajoutée le
 * 16/09/2026 (voir supabase/migrations/0024_shop_collaborators.sql,
 * src/lib/shop-access.ts et decisions-techniques.md pour le périmètre exact
 * de ce qu'un collaborateur peut faire : produits, commandes et aperçu en
 * lecture/écriture, jamais réglages boutique/abonnement/paiements/codes
 * promo/gestion des collaborateurs eux-mêmes).
 *
 * Page réservée au PROPRIÉTAIRE — lookup `owner_id` strict, jamais
 * `getAccessibleShop` : un collaborateur n'a délibérément aucun accès ici,
 * ni pour se voir lui-même ni pour en inviter d'autres.
 */
export default async function CollaborateursPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .eq("owner_id", user?.id ?? "")
    .maybeSingle();

  if (!shop) {
    redirect("/dashboard/boutique");
  }

  const subscription = await getShopSubscription(supabase, shop.id);

  const { data: collaborators } = await supabase
    .from("shop_collaborators")
    .select("id, invited_email, status, invited_at")
    .eq("shop_id", shop.id)
    .order("invited_at", { ascending: false });

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Collaborateurs</h1>
      <p className="mt-2 max-w-md text-sm text-encre/70">
        Invite une personne à gérer tes produits et commandes avec toi. Elle
        se connecte avec son propre compte et n&apos;a pas accès aux
        réglages de la boutique, à l&apos;abonnement, aux paiements ni aux
        codes promo.
      </p>

      {!subscription.features.canMultiUser ? (
        <p className="mt-4 max-w-md rounded-md border border-dashed border-ligne bg-brume px-3 py-2 text-sm text-encre/60">
          Les collaborateurs sont disponibles à partir du plan Pro.
        </p>
      ) : (
        <>
          <p className="mt-4 text-xs text-encre/50">
            {(collaborators ?? []).length} / {subscription.features.maxCollaborators}{" "}
            collaborateur(s) pour ton plan {subscription.planName ?? "actuel"}.
          </p>
          <InviteForm />
        </>
      )}

      <CollaboratorList
        collaborators={(collaborators ?? []) as Collaborator[]}
        canManage={subscription.features.canMultiUser}
      />
    </div>
  );
}
