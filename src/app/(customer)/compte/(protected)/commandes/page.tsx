import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ClaimOrdersButton } from "../claim-orders-button";
import { ORDER_STATUS_BADGE_CLASS, ORDER_STATUS_LABELS } from "@/lib/orders";

type CustomerOrder = {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
  shop: { name: string; slug: string } | { name: string; slug: string }[] | null;
};

export default async function CommandesPage() {
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
    <div className="mx-auto w-full max-w-lg">
      {/* Retour */}
      <Link
        href="/compte"
        className="mb-5 inline-flex items-center gap-1 text-sm text-encre/60 hover:text-vert-actif"
      >
        ‹ Retour
      </Link>

      {/* Titre */}
      <h1 className="font-display text-xl font-semibold text-encre">
        Mes commandes
      </h1>
      <p className="mt-1 text-sm text-encre/65">
        Retrouve ici toutes les commandes passées avec ce compte, chez
        n’importe quel vendeur de la plateforme.
      </p>

      {/* Bouton rattacher */}
      <div className="mt-4">
        <ClaimOrdersButton />
      </div>

      {/* Liste des commandes */}
      {(orders ?? []).length === 0 ? (
        <p className="mt-6 rounded-xl border border-ligne bg-white p-4 text-sm text-encre/70">
          Aucune commande rattachée à ce compte pour l’instant. Si tu as déjà
          commandé avant de créer ton compte, essaie « Rattacher mes anciennes
          commandes » ci-dessus (avec le même numéro de téléphone).
        </p>
      ) : (
        <ul className="mt-6 overflow-hidden rounded-xl border border-ligne bg-white">
          {(orders as CustomerOrder[]).map((order) => {
            const shop = Array.isArray(order.shop) ? order.shop[0] : order.shop;
            if (!shop) return null;

            return (
              <li key={order.id} className="border-b border-ligne last:border-0">
                <Link
                  href={`/${shop.slug}/commande/${order.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-brume/50"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-encre">
                        {shop.name}
                      </p>
                      <span
                        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                          ORDER_STATUS_BADGE_CLASS[order.status] ??
                          "bg-brume text-encre/60"
                        }`}
                      >
                        {ORDER_STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-encre/60">
                      <span className="font-mono text-vert-actif">
                        {order.total_amount.toLocaleString("fr-FR")} FCFA
                      </span>
                      {" — "}
                      {new Date(order.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <span className="text-encre/30">›</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}