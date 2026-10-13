"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAllCarts } from "@/lib/cart/useShopCart";
import { createClient } from "@/lib/supabase/client";
import { fcfa } from "@/lib/utils/money";
import { ProductImage } from "@/components/product-image";
import { BagIcon, EmptyState } from "@/components/empty-state";

type ShopInfo = { slug: string; name: string; logo_url: string | null };

/**
 * « Mes paniers » (13/10/2026, lot 3 UX) : sur KEVA, un panier = une
 * boutique (une commande ne mélange jamais deux vendeurs). L'onglet Panier
 * de la barre du bas menait au panier de la dernière boutique visitée, et
 * restait grisé tant qu'on n'en avait visité aucune. Cette page regroupe
 * tous les paniers en cours, boutique par boutique.
 */
export default function PaniersPage() {
  const { carts } = useAllCarts();
  const [shops, setShops] = useState<Record<string, ShopInfo>>({});
  const slugsKey = carts.map((c) => c.shopSlug).join(",");

  useEffect(() => {
    if (!slugsKey) return;
    let cancelled = false;
    createClient()
      .from("shops")
      .select("slug, name, logo_url")
      .in("slug", slugsKey.split(","))
      .then(({ data }) => {
        if (cancelled || !data) return;
        setShops(Object.fromEntries(data.map((shop) => [shop.slug, shop])));
      });
    return () => {
      cancelled = true;
    };
  }, [slugsKey]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="font-display text-xl font-semibold text-encre">Mes paniers</h1>
      {carts.length > 0 ? (
        <p className="mt-1 text-sm text-encre/70">
          Un panier par boutique : chaque vendeur reçoit sa propre commande.
        </p>
      ) : null}

      {carts.length === 0 ? (
        <EmptyState
          icon={<BagIcon />}
          title="Aucun panier en cours"
          text="Ajoute des articles depuis une boutique : ils apparaîtront ici."
          action={{ href: "/", label: "Découvrir la marketplace" }}
        />
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {carts.map((cart) => {
            const shop = shops[cart.shopSlug];
            const count = cart.items.reduce((n, item) => n + item.quantity, 0);
            const total = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
            return (
              <li key={cart.shopSlug} className="rounded-2xl border border-ligne bg-white p-4">
                <div className="flex items-center gap-3">
                  {shop?.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- petit logo, domaine vendeur variable
                    <img src={shop.logo_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brume text-sm font-semibold text-vert-actif">
                      {(shop?.name ?? cart.shopSlug).charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-encre">{shop?.name ?? cart.shopSlug}</p>
                    <p className="text-xs text-encre/70">
                      {count} article{count > 1 ? "s" : ""} ·{" "}
                      <span className="font-display font-bold tabular-nums text-vert-actif">{fcfa(total)}</span>
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  {cart.items.slice(0, 4).map((item) => (
                    <ProductImage
                      key={item.key}
                      src={item.imageUrl}
                      alt={item.title}
                      className="h-14 w-14 shrink-0 rounded-lg border border-ligne/70"
                    />
                  ))}
                  {cart.items.length > 4 ? (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-brume text-xs font-semibold text-encre/70">
                      +{cart.items.length - 4}
                    </span>
                  ) : null}
                </div>
                <Link
                  href={`/${cart.shopSlug}/panier`}
                  className="mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-vert-actif text-sm font-semibold text-ivoire transition hover:bg-vert-sapin"
                >
                  Voir le panier et commander
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
