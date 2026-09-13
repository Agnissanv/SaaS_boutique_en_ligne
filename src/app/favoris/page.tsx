"use client";

import Link from "next/link";
import { useWishlist } from "@/lib/wishlist/useWishlist";

/**
 * Liste de favoris — page client (localStorage, pas de compte client, voir
 * useWishlist.ts). "use client" sur toute la page plutôt qu'un Server
 * Component wrapper : rien à charger côté serveur, tout vient du navigateur.
 */
export default function FavorisPage() {
  const { items, remove } = useWishlist();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-xl font-semibold text-gray-900">Mes favoris</h1>

      {items.length === 0 ? (
        <div className="mt-6">
          <p className="text-sm text-gray-600">
            Tu n&apos;as encore ajouté aucun produit à tes favoris.
          </p>
          <Link href="/" className="mt-2 inline-block text-sm underline">
            Découvrir des produits
          </Link>
        </div>
      ) : (
        <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {items.map((item) => (
            <div key={item.productId} className="relative rounded border border-gray-200 p-3">
              <button
                type="button"
                onClick={() => remove(item.productId)}
                aria-label="Retirer des favoris"
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-sm shadow"
              >
                ✕
              </button>
              <Link href={`/${item.shopSlug}/${item.productSlug}`}>
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- image uploadée par le vendeur, source dynamique
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="mb-2 aspect-square w-full rounded object-cover"
                  />
                ) : (
                  <div className="mb-2 aspect-square w-full rounded bg-gray-100" />
                )}
                <p className="text-sm font-medium text-gray-900">{item.title}</p>
                <p className="text-sm text-gray-600">{item.price} FCFA</p>
              </Link>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
