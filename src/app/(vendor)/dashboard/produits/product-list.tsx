"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toggleProductActive, deleteProduct, bulkToggleActive } from "./actions";

type Product = {
  id: string;
  title: string;
  price: number;
  stock: number;
  is_active: boolean;
  product_images: { url: string; position: number }[];
};

/**
 * Liste des produits avec sélection multiple + actions groupées — extrait de
 * page.tsx (Server Component) en Client Component le 15/09/2026 pour porter
 * les cases à cocher (état local, impossible en Server Component). Demandé
 * par Isaac ("essentiel pour concurrencer") : un vendeur avec un large
 * catalogue devait jusqu'ici activer/désactiver produit par produit.
 */
export function ProductList({ products }: { products: Product[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) =>
      prev.size === products.length ? new Set() : new Set(products.map((p) => p.id))
    );
  }

  function handleBulk(nextActive: boolean) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startTransition(async () => {
      await bulkToggleActive(ids, nextActive);
      setSelected(new Set());
    });
  }

  if (products.length === 0) {
    return (
      <p className="mt-4 text-sm text-gray-600">
        Aucun produit pour l&apos;instant. Ajoute ton premier produit pour
        qu&apos;il apparaisse sur ta boutique.
      </p>
    );
  }

  return (
    <div>
      <div className="mt-4 flex items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5 text-gray-600">
          <input
            type="checkbox"
            checked={selected.size === products.length}
            onChange={toggleSelectAll}
          />
          Tout sélectionner
        </label>
        {selected.size > 0 && (
          <>
            <span className="text-gray-400">{selected.size} sélectionné(s)</span>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleBulk(true)}
              className="text-gray-700 underline disabled:opacity-50"
            >
              Activer
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleBulk(false)}
              className="text-gray-700 underline disabled:opacity-50"
            >
              Désactiver
            </button>
          </>
        )}
      </div>

      <ul className="mt-2 divide-y divide-gray-200">
        {products.map((product) => {
          const thumbnail = [...(product.product_images ?? [])].sort(
            (a, b) => a.position - b.position
          )[0]?.url;
          return (
            <li
              key={product.id}
              className="flex items-center justify-between gap-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(product.id)}
                  onChange={() => toggleSelected(product.id)}
                />
                {thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element -- image uploadée par le vendeur, source dynamique
                  <img
                    src={thumbnail}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded bg-gray-100" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {product.title}
                    {!product.is_active && (
                      <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                        désactivé
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-600">
                    {product.price} FCFA — stock : {product.stock}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/dashboard/produits/${product.id}`}
                  className="text-sm text-gray-700 underline"
                >
                  Modifier
                </Link>
                <Link
                  href={`/dashboard/produits/nouveau?depuis=${product.id}`}
                  className="text-sm text-gray-700 underline"
                >
                  Dupliquer
                </Link>
                <form
                  action={toggleProductActive.bind(
                    null,
                    product.id,
                    !product.is_active
                  )}
                >
                  <button type="submit" className="text-sm text-gray-700 underline">
                    {product.is_active ? "Désactiver" : "Activer"}
                  </button>
                </form>
                <form action={deleteProduct.bind(null, product.id)}>
                  <button type="submit" className="text-sm text-red-600 underline">
                    Supprimer
                  </button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
