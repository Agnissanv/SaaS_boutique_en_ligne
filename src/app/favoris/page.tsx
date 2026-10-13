"use client";

import { fcfa } from "@/lib/utils/money";

import Link from "next/link";
import { useWishlist } from "@/lib/wishlist/useWishlist";
import { ProductImage } from "@/components/product-image";
import { EmptyState, HeartIcon } from "@/components/empty-state";

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
      {/* Retour accueil sur ordinateur (13/10/2026, lot 4) : la barre basse
          n'y est pas affichée, la page n'avait aucune sortie. */}
      <Link
        href="/"
        className="mb-4 hidden text-sm font-medium text-encre/70 transition-colors hover:text-vert-actif sm:inline-flex kv-link-back"
      >
        Accueil
      </Link>
      <h1 className="font-display text-xl font-semibold text-encre">Mes favoris</h1>

      {items.length === 0 ? (
        <EmptyState
          icon={<HeartIcon />}
          title="Aucun favori pour l'instant"
          text="Touche le cœur sur un produit pour le retrouver ici."
          action={{ href: "/", label: "Découvrir des produits" }}
        />
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
                  <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0 font-display font-bold tabular-nums text-sm text-vert-actif">
                    {fcfa(item.price)}
                    {hasDiscount ? (
                      <span className="tabular-nums text-xs text-encre/70 line-through">
                        {fcfa(item.compareAtPrice)}
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
