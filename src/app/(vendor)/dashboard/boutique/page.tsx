import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getShopSubscription, parseFeatureFlags } from "@/lib/subscription";
import { ShopForm } from "./shop-form";
import { ShareShopLinks } from "./share-shop-links";
import { acceptCollaboratorInvite } from "./actions";

// Réglages boutique : nom, description, catégorie, logo, couverture, lien
// public (slug). cf. cahier des charges §3.1.A.2.
//
// Upload logo/couverture : implémenté (Supabase Storage, bucket public
// "shop-assets" — voir ImageField dans shop-form.tsx). Reste optionnel :
// un vendeur peut créer sa boutique et vendre sans logo.
export default async function ShopSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: shop } = await supabase
    .from("shops")
    .select(
      "id, name, slug, description, category, logo_url, cover_url, accent_color, delivery_fee, whatsapp_number, notification_email"
    )
    .eq("owner_id", user?.id ?? "")
    .maybeSingle();

  // Réglages boutique réservés au PROPRIÉTAIRE (plan Pro multi-utilisateurs,
  // ajouté le 16/09/2026 — voir src/lib/shop-access.ts) : un collaborateur
  // actif qui arrive ici directement (lien deviné, favori...) est renvoyé
  // vers l'aperçu plutôt que de voir "crée ta boutique", qui n'aurait aucun
  // sens pour lui.
  if (!shop && user) {
    const { data: activeCollab } = await supabase
      .from("shop_collaborators")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (activeCollab) {
      redirect("/dashboard");
    }
  }

  // Invitation de collaborateur en attente sur l'email du compte connecté
  // (plan Pro, ajoutée le 16/09/2026) : affichée ici plutôt que de forcer la
  // création d'une boutique, seul cas où quelqu'un sans boutique arrive sur
  // cette page pour une autre raison que "en créer une".
  let pendingInvite: { shopId: string; shopName: string } | null = null;
  if (!shop && user?.email) {
    const { data: invite } = await supabase
      .from("shop_collaborators")
      .select("shop_id, shops(name)")
      .eq("invited_email", user.email)
      .eq("status", "pending")
      .maybeSingle();
    if (invite) {
      const inviteShop = Array.isArray(invite.shops) ? invite.shops[0] : invite.shops;
      if (inviteShop) {
        pendingInvite = { shopId: invite.shop_id, shopName: inviteShop.name };
      }
    }
  }

  // Personnalisation de la marque : logo (tous plans depuis le 22/09/2026,
  // migration 0041_starter_logo_unlock.sql) et couleur d'accent (Pro) —
  // ajouté le 16/09/2026, voir shop-form.tsx/actions.ts pour l'application
  // complète.
  //
  // Pas de boutique = pas d'abonnement encore, donc on ne peut pas lire
  // `getShopSubscription` (elle a besoin d'un shop.id). Corrigé le
  // 23/09/2026 : ce cas hardcodait "none" ("équivalent Starter"), exact au
  // 16/09/2026 mais jamais mis à jour quand Starter a débloqué le logo le
  // 22/09/2026 — un vendeur créant sa boutique voyait donc "Logo réservé au
  // plan Business" alors que son futur plan Starter l'autorise déjà (bug
  // remonté par Isaac juste après le lancement). On lit maintenant le plan
  // Starter réel en base au lieu de deviner sa valeur en dur, pour ne plus
  // jamais diverger si ce plan change à nouveau (même logique que
  // DEFAULT_FEATURE_FLAGS/parseFeatureFlags dans subscription.ts, qui reste
  // volontairement à "none" pour un cas différent : une boutique EXISTANTE
  // sans abonnement du tout, un cas anormal, pas la création).
  let canCustomizeBranding: "none" | "basic" | "complete" = "none";
  if (shop) {
    canCustomizeBranding = (await getShopSubscription(supabase, shop.id)).features
      .canCustomizeBranding;
  } else {
    const { data: starterPlan } = await supabase
      .from("subscription_plans")
      .select("features")
      .eq("code", "starter")
      .maybeSingle();
    canCustomizeBranding = parseFeatureFlags(starterPlan?.features).canCustomizeBranding;
  }

  if (pendingInvite) {
    return (
      <div>
        <h1 className="font-display text-lg font-semibold text-encre">
          Invitation à rejoindre une boutique
        </h1>
        <p className="mt-2 max-w-md text-sm text-encre/70">
          <strong>{pendingInvite.shopName}</strong> t&apos;invite à gérer ses
          produits et commandes sur KEVA.
        </p>
        <form action={acceptCollaboratorInvite} className="mt-4">
          <input type="hidden" name="shopId" value={pendingInvite.shopId} />
          <button
            type="submit"
            className="rounded-md bg-vert-actif px-4 py-2 text-sm font-medium text-ivoire hover:bg-vert-sapin"
          >
            Accepter l&apos;invitation
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Ma boutique</h1>
      <p className="mt-2 text-sm text-encre/70">
        {shop
          ? "Modifie les informations de ta boutique."
          : "Crée ta boutique pour commencer à ajouter des produits."}
      </p>
      <ShopForm shop={shop ?? null} canCustomizeBranding={canCustomizeBranding} />

      {shop ? (
        <ShareShopLinks
          shopUrl={`${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/${shop.slug}`}
        />
      ) : null}
    </div>
  );
}
