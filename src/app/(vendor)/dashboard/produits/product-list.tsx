"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toggleProductActive, deleteProduct, bulkToggleActive } from "./actions";
import { categoryLabel } from "@/lib/categories";
import {
  LOW_STOCK_THRESHOLD,
  stockHealth,
  STOCK_HEALTH_LABELS,
  STOCK_HEALTH_BAR_CLASS,
} from "@/lib/products";

type Product = {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  price: number;
  stock: number;
  stock_alert_threshold: number | null;
  is_active: boolean;
  product_images: { url: string; position: number }[];
};

type ViewMode = "table" | "grid";

/**
 * Liste des produits avec sélection multiple + actions groupées — extrait de
 * page.tsx (Server Component) en Client Component le 15/09/2026 pour porter
 * les cases à cocher (état local, impossible en Server Component). Demandé
 * par Isaac ("essentiel pour concurrencer") : un vendeur avec un large
 * catalogue devait jusqu'ici activer/désactiver produit par produit.
 *
 * Refonte visuelle du 15/09/2026 (maquette du designer UX/UI d'Isaac,
 * adaptée aux couleurs/typo KEVA) : bascule tableau/grille, barre de santé
 * du stock (couleur selon LOW_STOCK_THRESHOLD, jamais un chiffre "objectif"
 * inventé — voir src/lib/products.ts) et interrupteur actif/inactif à la
 * place du lien texte. Les actions serveur appelées restent identiques
 * (toggleProductActive/bulkToggleActive/deleteProduct), avec leur
 * vérification de propriété inchangée côté serveur — seul l'habillage
 * change. L'interrupteur individuel appelle désormais directement l'action
 * serveur via `startTransition` (comme les actions groupées) plutôt qu'un
 * `<form>` classique, pour l'animation immédiate sans rechargement.
 */
export function ProductList({ products }: { products: Product[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [view, setView] = useState<ViewMode>("table");
  const [isPending, startTransition] = useTransition();
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);

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

  function handleToggleActive(product: Product) {
    setPendingToggleId(product.id);
    startTransition(async () => {
      await toggleProductActive(product.id, !product.is_active);
      setPendingToggleId(null);
    });
  }

  if (products.length === 0) {
    return (
      <p className="mt-6 text-sm text-encre/60">
        Aucun produit ne correspond. Ajoute ton premier produit, ou modifie
        les filtres ci-dessus, pour qu&apos;il apparaisse ici.
      </p>
    );
  }

  return (
    <div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5 text-encre/60">
          <input
            type="checkbox"
            checked={selected.size === products.length}
            onChange={toggleSelectAll}
          />
          Tout sélectionner
        </label>
        {selected.size > 0 && (
          <>
            <span className="text-encre/40">{selected.size} sélectionné(s)</span>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleBulk(true)}
              className="text-vert-actif underline disabled:opacity-50"
            >
              Activer
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleBulk(false)}
              className="text-vert-actif underline disabled:opacity-50"
            >
              Désactiver
            </button>
          </>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1 rounded-md border border-ligne p-0.5">
          <button
            type="button"
            title="Vue tableau"
            onClick={() => setView("table")}
            className={`rounded p-1.5 ${view === "table" ? "bg-vert-sapin text-ivoire" : "text-encre/50 hover:text-encre"}`}
          >
            <IconList className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Vue grille"
            onClick={() => setView("grid")}
            className={`rounded p-1.5 ${view === "grid" ? "bg-vert-sapin text-ivoire" : "text-encre/50 hover:text-encre"}`}
          >
            <IconGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {view === "table" ? (
        <ProductTable
          products={products}
          selected={selected}
          onToggleSelected={toggleSelected}
          onToggleActive={handleToggleActive}
          pendingToggleId={pendingToggleId}
        />
      ) : (
        <ProductGrid
          products={products}
          selected={selected}
          onToggleSelected={toggleSelected}
          onToggleActive={handleToggleActive}
          pendingToggleId={pendingToggleId}
        />
      )}
    </div>
  );
}

function thumbnailOf(product: Product) {
  return [...(product.product_images ?? [])].sort((a, b) => a.position - b.position)[0]?.url;
}

type ListProps = {
  products: Product[];
  selected: Set<string>;
  onToggleSelected: (id: string) => void;
  onToggleActive: (product: Product) => void;
  pendingToggleId: string | null;
};

function ProductTable({ products, selected, onToggleSelected, onToggleActive, pendingToggleId }: ListProps) {
  return (
    <div className="mt-3 overflow-x-auto rounded-md border border-ligne bg-white">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-ligne text-xs uppercase tracking-wide text-encre/50">
            <th className="w-8 px-3 py-2"></th>
            <th className="px-3 py-2 font-medium">Produit</th>
            <th className="px-3 py-2 font-medium">Catégorie</th>
            <th className="px-3 py-2 font-medium">Prix</th>
            <th className="w-40 px-3 py-2 font-medium">Stock</th>
            <th className="px-3 py-2 font-medium">Statut</th>
            <th className="px-3 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ligne">
          {products.map((product) => {
            const thumbnail = thumbnailOf(product);
            return (
              <tr key={product.id} className="align-middle">
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(product.id)}
                    onChange={() => onToggleSelected(product.id)}
                  />
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    {thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element -- image uploadée par le vendeur, source dynamique
                      <img src={thumbnail} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
                    ) : (
                      <div className="h-9 w-9 shrink-0 rounded bg-brume" />
                    )}
                    <span className="truncate font-medium text-encre">{product.title}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-encre/70">
                  {product.category ? categoryLabel(product.category) : "—"}
                </td>
                <td className="px-3 py-2.5 text-encre/70">{product.price} FCFA</td>
                <td className="px-3 py-2.5">
                  <StockBar stock={product.stock} threshold={product.stock_alert_threshold} />
                </td>
                <td className="px-3 py-2.5">
                  <ActiveToggle
                    isActive={product.is_active}
                    pending={pendingToggleId === product.id}
                    onToggle={() => onToggleActive(product)}
                  />
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5 whitespace-nowrap text-encre/70">
                    <Link href={`/dashboard/produits/${product.id}`} transitionTypes={["nav-forward"]} className="underline hover:text-vert-actif">
                      Modifier
                    </Link>
                    <Link href={`/dashboard/produits/nouveau?depuis=${product.id}`} transitionTypes={["nav-forward"]} className="underline hover:text-vert-actif">
                      Dupliquer
                    </Link>
                    <form action={deleteProduct.bind(null, product.id)}>
                      <button type="submit" className="text-erreur underline">
                        Supprimer
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProductGrid({ products, selected, onToggleSelected, onToggleActive, pendingToggleId }: ListProps) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => {
        const thumbnail = thumbnailOf(product);
        return (
          <div key={product.id} className="flex flex-col rounded-md border border-ligne bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <input
                type="checkbox"
                checked={selected.has(product.id)}
                onChange={() => onToggleSelected(product.id)}
              />
              <ActiveToggle
                isActive={product.is_active}
                pending={pendingToggleId === product.id}
                onToggle={() => onToggleActive(product)}
              />
            </div>
            {thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element -- image uploadée par le vendeur, source dynamique
              <img src={thumbnail} alt="" className="mt-2 aspect-square w-full rounded object-cover" />
            ) : (
              <div className="mt-2 aspect-square w-full rounded bg-brume" />
            )}
            <p className="mt-2 truncate text-sm font-medium text-encre">{product.title}</p>
            <p className="text-xs text-encre/60">
              {product.category ? categoryLabel(product.category) : "—"} · {product.price} FCFA
            </p>
            <div className="mt-2">
              <StockBar stock={product.stock} threshold={product.stock_alert_threshold} />
            </div>
            <div className="mt-3 flex items-center gap-2.5 text-xs text-encre/70">
              <Link href={`/dashboard/produits/${product.id}`} transitionTypes={["nav-forward"]} className="underline hover:text-vert-actif">
                Modifier
              </Link>
              <Link href={`/dashboard/produits/nouveau?depuis=${product.id}`} transitionTypes={["nav-forward"]} className="underline hover:text-vert-actif">
                Dupliquer
              </Link>
              <form action={deleteProduct.bind(null, product.id)} className="ml-auto">
                <button type="submit" className="text-erreur underline">
                  Supprimer
                </button>
              </form>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Barre de santé du stock — couleur + longueur relative au seuil d'alerte,
 * jamais un chiffre "objectif" inventé (la maquette d'origine affichait un
 * ratio type 900/1000 qui n'a pas d'équivalent dans nos données). Longueur
 * bornée entre 10% (toujours visible, même en rupture) et 100% (atteint à 5x
 * le seuil, au-delà tout est "plein").
 *
 * `threshold` : seuil personnalisé du produit (plan Pro, ajouté le
 * 16/09/2026 — voir src/lib/products.ts) ; `null` retombe sur
 * `LOW_STOCK_THRESHOLD` comme avant pour tous les autres plans.
 */
function StockBar({ stock, threshold }: { stock: number; threshold: number | null }) {
  const effectiveThreshold = threshold ?? LOW_STOCK_THRESHOLD;
  const health = stockHealth(stock, effectiveThreshold);
  const pct = Math.min(100, Math.max(10, (stock / (effectiveThreshold * 5)) * 100));
  return (
    <div className="w-full min-w-[7rem]">
      <div className="flex items-center justify-between text-xs text-encre/60">
        <span>{STOCK_HEALTH_LABELS[health]}</span>
        <span className="tabular-nums">{stock}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-brume">
        <div
          className={`h-full rounded-full ${STOCK_HEALTH_BAR_CLASS[health]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ActiveToggle({
  isActive,
  pending,
  onToggle,
}: {
  isActive: boolean;
  pending: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isActive}
      disabled={pending}
      onClick={onToggle}
      title={isActive ? "Désactiver" : "Activer"}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        isActive ? "bg-succes" : "bg-ligne"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
          isActive ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function IconList(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

function IconGrid(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
