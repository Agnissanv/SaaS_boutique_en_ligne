import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getShopSubscription } from "@/lib/subscription";
import { getAccessibleShop } from "@/lib/shop-access";
import { toWhatsappNumber } from "@/lib/utils/whatsapp";

type CartItemSnapshot = {
  title: string;
  quantity: number;
  price: number;
  variantLabel: string | null;
};

type AbandonedCartRow = {
  customer_name: string;
  customer_phone: string;
  cart_snapshot: CartItemSnapshot[];
  cart_total: number;
  updated_at: string;
};

const FMT_FCFA = new Intl.NumberFormat("fr-FR");
const MAX_AGE_DAYS = 7;

/**
 * Paniers abandonnés — relance MANUELLE par le vendeur, 23/09/2026. Voir
 * migration 0044 pour le détail complet du raisonnement (pourquoi manuel et
 * pas un email automatique : quota Brevo partagé par toute la plateforme +
 * marché WhatsApp-first où l'email client est optionnel et rarement fourni
 * — décision explicite d'Isaac : "si ça peut être de façon manuelle pour le
 * vendeur, pas dans notre quota de Brevo, ça sera parfait").
 *
 * KEVA ne fait qu'une chose : afficher qui a rempli le formulaire de
 * commande sans jamais cliquer sur "Confirmer", avec un bouton WhatsApp
 * pré-rempli. C'est le vendeur qui écrit, quand il veut, s'il veut — aucun
 * message n'est jamais envoyé "au nom de" KEVA.
 *
 * Gate Business+ (`hasAdvancedStats`) : réutilise le palier déjà existant
 * plutôt que d'ajouter un nouveau flag jsonb pour une fonctionnalité de même
 * ordre de valeur commerciale que les statistiques avancées — voir
 * decisions-techniques.md.
 *
 * Accessible à un collaborateur actif (plan Pro), même périmètre que
 * Commandes/Statistiques (`getAccessibleShop`) : relancer un client fait
 * partie du travail commercial courant, pas une donnée réservée au
 * propriétaire.
 */
export default async function AbandonedCartsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const access = user ? await getAccessibleShop(supabase, user.id) : null;
  if (!access) {
    redirect("/dashboard/boutique");
  }

  const subscription = await getShopSubscription(supabase, access.shopId);

  if (!subscription.features.hasAdvancedStats) {
    return (
      <div>
        <h1 className="font-display text-lg font-semibold text-encre">Paniers abandonnés</h1>
        <p className="mt-2 max-w-md text-sm text-encre/70">
          Vois qui a rempli le formulaire de commande sans jamais valider, et
          relance-le toi-même sur WhatsApp en un clic.
        </p>
        <p className="mt-4 max-w-md rounded-md border border-dashed border-ligne bg-brume px-3 py-2 text-sm text-encre/60">
          Disponible à partir du plan Business.
        </p>
      </div>
    );
  }

  const since = new Date(new Date().getTime() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("abandoned_carts")
    .select("customer_name, customer_phone, cart_snapshot, cart_total, updated_at")
    .eq("shop_id", access.shopId)
    .gte("updated_at", since)
    .order("updated_at", { ascending: false })
    .limit(50);

  const carts = (data ?? []) as AbandonedCartRow[];

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Paniers abandonnés</h1>
      <p className="mt-2 max-w-md text-sm text-encre/70">
        Des clients qui ont commencé une commande sans la valider, sur les{" "}
        {MAX_AGE_DAYS} derniers jours. Relance-les toi-même, quand tu veux —
        KEVA n&apos;envoie jamais rien à ta place.
      </p>

      {carts.length === 0 ? (
        <p className="mt-6 text-sm text-encre/60">Aucun panier abandonné pour l&apos;instant.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {carts.map((cart) => {
            const itemsLabel = cart.cart_snapshot
              .map((item) => `${item.quantity}x ${item.title}${item.variantLabel ? ` (${item.variantLabel})` : ""}`)
              .join(", ");
            const message = `Bonjour ${cart.customer_name}, tu avais commencé une commande sur notre boutique (${itemsLabel}) mais tu ne l'as pas finalisée. Est-ce que je peux t'aider ?`;

            return (
              <li
                key={cart.customer_phone}
                className="rounded-lg border border-ligne bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-encre">{cart.customer_name}</p>
                    <p className="text-xs text-encre/50">{cart.customer_phone}</p>
                    <p className="mt-1 text-xs text-encre/40">
                      Vu le{" "}
                      {new Date(cart.updated_at).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <a
                    href={`https://wa.me/${toWhatsappNumber(cart.customer_phone)}?text=${encodeURIComponent(message)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white"
                  >
                    Contacter sur WhatsApp
                  </a>
                </div>
                <p className="mt-3 text-sm text-encre/70">{itemsLabel}</p>
                <p className="mt-1 font-mono text-sm text-vert-actif">
                  {FMT_FCFA.format(cart.cart_total)} FCFA
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
