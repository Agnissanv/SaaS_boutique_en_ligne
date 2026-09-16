import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getShopSubscription } from "@/lib/subscription";
import { PromoCodeList } from "./promo-code-list";
import { PromoCodeForm } from "./promo-code-form";

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
 */
export default async function PromoCodesPage() {
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

  const { data: promoCodes } = await supabase
    .from("promo_codes")
    .select("id, code, discount_type, discount_value, is_active, max_uses, used_count, expires_at")
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Codes promo</h1>
      <p className="mt-2 text-sm text-encre/70">
        Crée des codes de réduction que tes clients peuvent utiliser au
        moment de commander.
      </p>

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
