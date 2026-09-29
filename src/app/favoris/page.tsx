"use client";

import Link from "next/link";
import { useWishlist } from "@/lib/wishlist/useWishlist";
import { ProductImage } from "@/components/product-image";

/**
 * Liste de favoris — page client (localStorage, pas de compte client, voir
 * useWishlist.ts). "use client" sur toute la page plutôt qu'un Server
 * Component wrapper : rien à charger côté serveur, tout vient du navigateur.
 *
 * Recolorée en charte KEVA le 15/09/2026 (côté client) — pure recolor.
 */
export default function FavorisPage() {
  const { items, remove } = useWishlist();

  return (
    <main className="w-full mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-xl font-semibold text-encre">Mes favoris</h1>

      {items.length === 0 ? (
        <div className="mt-6">
          <p className="text-sm text-encre/70">
            Tu n&apos;as encore ajouté aucun produit à tes favoris.
          </p>
          <Link href="/" className="mt-2 inline-block text-sm text-vert-actif underline">
            Découvrir des produits
          </Link>
        </div>
      ) : (
        <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {items.map((item) => {
            const hasDiscount =
              item.compareAtPrice != null && item.compareAtPrice > item.price;
            return (
              <div key={item.productId} className="relative rounded-lg border border-ligne bg-white p-3">
                <button
                  type="button"
                  onClick={() => remove(item.productId)}
                  aria-label="Retirer des favoris"
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-sm text-encre shadow-sm"
                >
                  ✕
                </button>
                <Link href={`/${item.shopSlug}/${item.productSlug}`}>
                  {/* `<ProductImage>` (30/09/2026, audit technique — voir
                      audit-technique-2026-09-29.md) : ce composant est LE
                      point de rendu unique des photos produit dans tout le
                      projet (voir son commentaire) — cette page utilisait
                      encore un `<img>` brut avec son propre repli manuel au
                      lieu d'en bénéficier, ratant au passage le
                      redimensionnement responsive, le lazy-loading et le
                      repli visuel "pas de photo" communs partout ailleurs. */}
                  <ProductImage
                    src={item.imageUrl}
                    alt={item.title}
                    className="mb-2 aspect-square w-full rounded object-cover"
                  />
                  <p className="text-sm font-medium text-encre">{item.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0 font-mono text-sm text-vert-actif">
                    {item.price} FCFA
                    {hasDiscount ? (
                      <span className="font-mono text-xs text-encre/40 line-through">
                        {item.compareAtPrice} FCFA
                      </span>
                    ) : null}
                  </p>
                </Link>
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}
