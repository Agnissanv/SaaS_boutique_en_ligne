import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getShopSubscription } from "@/lib/subscription";
import { PromoCodeList } from "./promo-code-list";
import { PromoCodeForm } from "./promo-code-form";

type StatusFilter = "all" | "active" | "inactive" | "expired";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "active", label: "Actifs" },
  { value: "inactive", label: "Désactivés" },
  { value: "expired", label: "Expirés" },
];

export type PromoCode = {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  is_active: boolean;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
};

/**
 * Codes promo — plan Pro uniquement (`can_use_promo_codes`, ajouté le
 * 16/09/2026, spec tranchée par Isaac : réduction en pourcentage OU en
 * montant fixe, au choix du vendeur à la création de chaque code). Le
 * rabais est réellement appliqué et vérifié dans `create_order`
 * (migration 0023) — cette page ne fait que gérer les codes eux-mêmes.
 *
 * **Filtre de statut ajouté le 22/09/2026** (audit "filtres partout" d'Isaac),
 * mêmes onglets Tous/Actifs/Désactivés/Expirés que la vue admin
 * (`/admin/codes-promo`). Pas de pagination ici, volontairement : un code
 * promo se crée un par un via un formulaire dédié — même à l'échelle de
 * 1000-2000 boutiques, un vendeur individuel n'accumule réalistement pas des
 * centaines de ses propres codes, contrairement aux commandes/produits/avis.
 */
export default async function PromoCodesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusParam } = await searchParams;
  const status: StatusFilter =
    statusParam === "active" || statusParam === "inactive" || statusParam === "expired"
      ? statusParam
      : "all";

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

  let query = supabase
    .from("promo_codes")
    .select("id, code, discount_type, discount_value, is_active, max_uses, used_count, expires_at")
    .eq("shop_id", shop.id);

  if (status === "active") query = query.eq("is_active", true);
  if (status === "inactive") query = query.eq("is_active", false);
  if (status === "expired") query = query.lt("expires_at", new Date().toISOString());

  const { data: promoCodes } = await query.order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Codes promo</h1>
      <p className="mt-2 text-sm text-encre/70">
        Crée des codes de réduction que tes clients peuvent utiliser au
        moment de commander.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value === "all" ? "/dashboard/codes-promo" : `/dashboard/codes-promo?status=${tab.value}`}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              status === tab.value
                ? "border-vert-actif bg-vert-actif/10 font-medium text-vert-sapin"
                : "border-ligne text-encre/70 hover:border-vert-actif"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {!subscription.features.canUsePromoCodes ? (
        <p className="mt-4 max-w-md rounded-md border border-dashed border-ligne bg-brume px-3 py-2 text-sm text-encre/60">
          Les codes promo sont disponibles à partir du plan Pro.
        </p>
      ) : (
        <PromoCodeForm />
      )}

      <PromoCodeList
        promoCodes={(promoCodes ?? []) as PromoCode[]}
        canManage={subscription.features.canUsePromoCodes}
      />
    </div>
  );
}
