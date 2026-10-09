import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getShopSubscription } from "@/lib/subscription";
import { SettingsTabs } from "../../settings-tabs";
import { NotificationEmailForm } from "./notification-email-form";
import { PushNotificationToggle } from "./push-toggle";

/**
 * Onglet "Notifications" — ajouté le 30/09/2026 (refonte de l'espace
 * Paramètres, inspiration maquette générique "Lumina Store"). Réservé au
 * PROPRIÉTAIRE — lookup `owner_id` strict, même garde que Boutique/Paiements/
 * Abonnement/Collaborateurs (voir src/lib/shop-access.ts) : c'est un réglage
 * de BOUTIQUE (qui reçoit les emails), pas un réglage personnel.
 *
 * Ne construit PAS de préférence SMS (contrairement à la maquette de
 * référence) : KEVA n'a aucun système d'envoi de SMS, un interrupteur qui ne
 * ferait rien serait trompeur — décision prise avec Isaac (AskUserQuestion)
 * avant d'écrire cette page.
 */
export default async function NotificationsSettingsPage() {
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

  // `notification_email` n'est plus lisible directement par les rôles publics
  // (migration 0056, audit du 09/10/2026) : lecture via une fonction réservée
  // au propriétaire.
  const { data: notificationEmail } = await supabase.rpc("get_my_shop_notification_email");

  const subscription = await getShopSubscription(supabase, shop.id);

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Paramètres</h1>
      <p className="mt-2 text-sm text-encre/70">Gère ton profil, ta boutique et ton compte.</p>
      <SettingsTabs isOwner />

      <h2 className="mt-6 font-display text-sm font-semibold text-encre">Notifications</h2>

      {/* Notifications push (01/10/2026) — disponible sur TOUS les plans,
          contrairement à l'email ci-dessous (voir push-toggle.tsx) : gratuit
          à l'usage, aucun quota à ménager. */}
      <PushNotificationToggle vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />

      <h2 className="mt-6 font-display text-sm font-semibold text-encre">
        Notifications par email
      </h2>

      {subscription.features.hasOrderNotifications ? (
        <>
          <p className="mt-2 max-w-md text-sm text-encre/70">
            Reçois un email à chaque nouvelle commande
            {subscription.features.hasAdvancedStockAlerts
              ? " et quand un produit passe sous son seuil de stock"
              : ""}
            .
          </p>
          <NotificationEmailForm
            currentEmail={notificationEmail ?? null}
            accountEmail={user?.email ?? ""}
          />
          {!subscription.features.hasAdvancedStockAlerts && (
            <p className="mt-4 max-w-md rounded-md border border-dashed border-ligne bg-brume px-3 py-2 text-sm text-encre/60">
              Les alertes de stock bas par email sont disponibles à partir du
              plan Pro.
            </p>
          )}
        </>
      ) : (
        <p className="mt-4 max-w-md rounded-md border border-dashed border-ligne bg-brume px-3 py-2 text-sm text-encre/60">
          Les notifications par email (nouvelle commande, stock bas) sont
          disponibles à partir du plan Business.
        </p>
      )}
    </div>
  );
}
