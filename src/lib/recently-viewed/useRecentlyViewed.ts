"use client";

import { useCallback, useSyncExternalStore } from "react";

export type RecentlyViewedItem = {
  productId: string;
  shopSlug: string;
  shopName: string;
  productSlug: string;
  title: string;
  price: number;
  compareAtPrice?: number | null;
  imageUrl?: string;
};

/**
 * "Vus récemment" — ajouté le 21/09/2026, item du "plus tard" du cahier des
 * charges. Même pattern que `useWishlist` (localStorage, une seule clé
 * globale, `useSyncExternalStore`) et pour la même raison : le client final
 * n'a pas de compte (achat sans inscription, cœur du produit), donc rien à
 * relire côté serveur — l'historique de consultation vit uniquement dans le
 * navigateur du visiteur.
 *
 * Le plus récent en tête (`unshift`), dédupliqué par produit (une deuxième
 * visite du même produit le remonte en tête plutôt que de le dupliquer),
 * plafonné à `MAX_ITEMS` pour ne jamais grossir indéfiniment.
 */

const EMPTY: RecentlyViewedItem[] = [];
const STORAGE_KEY = "recently_viewed";
const MAX_ITEMS = 12;
const listeners = new Set<() => void>();
let cache: { raw: string | null; items: RecentlyViewedItem[] } | null = null;

function readRecentlyViewed(): RecentlyViewedItem[] {
  if (typeof window === "undefined") return EMPTY;

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }

  if (cache && cache.raw === raw) return cache.items;

  let items: RecentlyViewedItem[] = EMPTY;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) items = parsed;
    } catch {
      items = EMPTY;
    }
  }

  cache = { raw, items };
  return items;
}

function notify() {
  listeners.forEach((cb) => cb());
}

function writeRecentlyViewed(items: RecentlyViewedItem[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage indisponible (navigation privée...) : l'historique ne
    // persiste pas, mais la navigation continue de fonctionner normalement.
  }
  notify();
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

function getServerSnapshot() {
  return EMPTY;
}

export function useRecentlyViewed() {
  const items = useSyncExternalStore(subscribe, readRecentlyViewed, getServerSnapshot);

  const record = useCallback((item: RecentlyViewedItem) => {
    const current = readRecentlyViewed();
    const withoutItem = current.filter((i) => i.productId !== item.productId);
    writeRecentlyViewed([item, ...withoutItem].slice(0, MAX_ITEMS));
  }, []);

  return { items, record };
}
