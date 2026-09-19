import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ClaimOrdersButton } from "./claim-orders-button";
import { ORDER_STATUS_BADGE_CLASS, ORDER_STATUS_LABELS } from "@/lib/orders";
import { signOut } from "@/app/auth/actions";

type CustomerOrder = {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
  shop: { name: string; slug: string } | { name: string; slug: string }[] | null;
};

export default async function ComptePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Récupération du profil (nom)
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user?.id ?? "")
    .single();

  const { data: orders } = await supabase
    .from("orders")
    .select("id, status, total_amount, created_at, shop:shops(name, slug)")
    .eq("customer_id", user?.id ?? "")
    .order("created_at", { ascending: false });

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Mon compte";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="mx-auto w-full max-w-lg space-y-8">
      {/* ========== EN-TÊTE PROFIL ========== */}
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-vert-sapin text-lg font-semibold text-ivoire">
          {initial}
        </div>
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold text-encre">
            {displayName}
          </p>
          <Link
            href="/compte/profil"
            className="text-sm text-encre/60 hover:text-vert-actif"
          >
            Voir mon profil
          </Link>
        </div>
      </div>

      {/* ========== MES COMMANDES ========== */}
      <section>
        <h2 className="font-display text-base font-semibold text-encre">
          Mes commandes
        </h2>
        <p className="mt-1 text-sm text-encre/65">
          Retrouve ici toutes les commandes passées avec ce compte.
        </p>

        <div className="mt-3">
          <ClaimOrdersButton />
        </div>

        {(orders ?? []).length === 0 ? (
          <p className="mt-4 rounded-xl border border-ligne bg-white p-4 text-sm text-encre/70">
            Aucune commande rattachée à ce compte pour l’instant.
          </p>
        ) : (
          <ul className="mt-4 overflow-hidden rounded-xl border border-ligne bg-white">
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
                            "bg-sable text-encre/60"
                          }`}
                        >
                          {ORDER_STATUS_LABELS[order.status] ?? order.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-encre/60">
                        <span className="font-mono text-cuivre-profond">
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
      </section>

      {/* ========== MON COMPTE ========== */}
      <section>
        <h2 className="mb-2 font-display text-base font-semibold text-encre">
          Mon compte
        </h2>
        <div className="overflow-hidden rounded-xl border border-ligne bg-white">
          <AccountLink href="/compte/profil" label="Informations personnelles" />
          <AccountLink href="/compte/profil" label="Sécurité & connexion" />
          <AccountLink href="/compte/profil" label="Notifications" last />
        </div>
      </section>

      {/* ========== AIDE ========== */}
      <section>
        <h2 className="mb-2 font-display text-base font-semibold text-encre">
          Aide & Support
        </h2>
        <div className="overflow-hidden rounded-xl border border-ligne bg-white">
          <AccountLink href="#" label="Centre d’aide" />
          <AccountLink href="#" label="Nous contacter" />
          <AccountLink href="#" label="Donner un avis" last />
        </div>
      </section>

      {/* ========== LÉGAL ========== */}
      <section>
        <h2 className="mb-2 font-display text-base font-semibold text-encre">
          Légal
        </h2>
        <div className="overflow-hidden rounded-xl border border-ligne bg-white">
          <AccountLink href="#" label="Conditions d’utilisation" />
          <AccountLink href="#" label="Politique de confidentialité" last />
        </div>
      </section>

      {/* ========== DÉCONNEXION ========== */}
      <form action={signOut}>
        <button
          type="submit"
          className="w-full rounded-xl border border-ligne bg-white px-4 py-3.5 text-left text-sm font-medium text-erreur transition hover:bg-erreur/5"
        >
          Déconnexion
        </button>
      </form>
    </div>
  );
}

/* Petit composant local pour les lignes de menu */
function AccountLink({
  href,
  label,
  last = false,
}: {
  href: string;
  label: string;
  last?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between px-4 py-3.5 text-sm text-encre transition hover:bg-brume/50 ${
        last ? "" : "border-b border-ligne"
      }`}
    >
      <span>{label}</span>
      <span className="text-encre/30">›</span>
    </Link>
  );
}