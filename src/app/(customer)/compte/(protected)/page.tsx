import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ClaimOrdersButton } from "./claim-orders-button";
import { ORDER_STATUS_BADGE_CLASS, ORDER_STATUS_LABELS } from "@/lib/orders";

type CustomerOrder = {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
  shop: { name: string; slug: string } | { name: string; slug: string }[] | null;
};

/**
 * Tableau de bord client — historique des commandes passées avec un compte
 * (§ compte client optionnel, migration 0014). Lecture directe de `orders`
 * via RLS (`orders_customer_read`, `auth.uid() = customer_id`) plutôt que
 * par RPC à jeton comme le flux invité (get_order_receipt) : ici l'identité
 * est déjà prouvée par la session, pas besoin d'un id de commande comme
 * preuve d'accès.
 *
 * Chaque commande renvoie vers sa page de confirmation habituelle
 * (/[shopSlug]/commande/[orderId]) plutôt que de dupliquer l'affichage du
 * détail/reçu ici — c'est aussi là que se trouve le formulaire d'avis.
 *
 * Recolorée en charte KEVA le 15/09/2026 (côté client) : le dictionnaire de
 * statuts local dupliqué a été retiré au profit du module partagé
 * `src/lib/orders.ts` (déjà utilisé par le dashboard vendeur) — badge de
 * statut désormais coloré (succes/attention/erreur) au lieu d'une pastille
 * grise, montant en IBM Plex Mono/Cuivre Profond.
 */
export default async function ComptePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: orders } = await supabase
    .from("orders")
    .select("id, status, total_amount, created_at, shop:shops(name, slug)")
    .eq("customer_id", user?.id ?? "")
    .order("created_at", { ascending: false });

  return (
    <div className="w-full mx-auto max-w-2xl">
      <h1 className="font-display text-lg font-semibold text-encre">Mes commandes</h1>
      <p className="mt-1 text-sm text-encre/70">
        Retrouve ici toutes les commandes passées avec ce compte, chez
        n&apos;importe quel vendeur de la plateforme.
      </p>
      <ClaimOrdersButton />

      {(orders ?? []).length === 0 ? (
        <p className="mt-6 rounded-lg border border-ligne bg-white p-4 text-sm text-encre/70">
          Aucune commande rattachée à ce compte pour l&apos;instant. Si tu as
          déjà commandé avant de créer ton compte, essaie « Rattacher mes
          anciennes commandes » ci-dessus (avec le même numéro de téléphone).
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-ligne rounded-lg border border-ligne bg-white">
          {(orders as CustomerOrder[]).map((order) => {
            const shop = Array.isArray(order.shop) ? order.shop[0] : order.shop;
            if (!shop) return null;
            return (
              <li key={order.id}>
                <Link
                  href={`/${shop.slug}/commande/${order.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-brume/60"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-encre">
                      {shop.name}
                      <span
                        className={`ml-2 rounded px-1.5 py-0.5 text-xs ${
                          ORDER_STATUS_BADGE_CLASS[order.status] ?? "bg-sable text-encre/60"
                        }`}
                      >
                        {ORDER_STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </p>
                    <p className="text-sm text-encre/70">
                      <span className="font-mono text-cuivre-profond">{order.total_amount} FCFA</span>{" "}
                      — {new Date(order.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
