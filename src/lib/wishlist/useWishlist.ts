"use client";

import { useCallback, useSyncExternalStore } from "react";

export type WishlistItem = {
  productId: string;
  shopSlug: string;
  productSlug: string;
  title: string;
  price: number;
  /**
   * Prix barré — ajouté le 17/09/2026 pour afficher la réduction sur la page
   * favoris elle-même, pas seulement là où le produit a été ajouté.
   * Optionnel : les favoris déjà enregistrés en localStorage avant cet ajout
   * n'ont pas ce champ, et s'affichent simplement sans prix barré.
   */
  compareAtPrice?: number | null;
  imageUrl?: string;
};

/**
 * Liste de favoris — ajoutée le 14/09/2026 (analyse comparative Jumia,
 * demande d'Isaac). Même pattern que `useShopCart` (localStorage,
 * `useSyncExternalStore`, pas de compte client), MAIS volontairement UNE
 * SEULE clé globale plutôt qu'une par boutique : contrairement au panier
 * (une commande porte sur une seule boutique), un client parcourt la
 * marketplace across plusieurs boutiques et doit pouvoir garder des favoris
 * de vendeurs différents dans une seule liste "Mes favoris".
 *
 * Chaque item stocke tout ce qu'il faut pour s'afficher/se lier sans
 * requête supplémentaire (titre, prix, image, slug boutique+produit) — même
 * choix que CartItem, pour la même raison (le client n'a pas de compte,
 * rien à aller relire côté serveur).
 */

const EMPTY: WishlistItem[] = [];
const STORAGE_KEY = "wishlist";
const listeners = new Set<() => void>();
let cache: { raw: string | null; items: WishlistItem[] } | null = null;

function readWishlist(): WishlistItem[] {
  if (typeof window === "undefined") return EMPTY;

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }

  if (cache && cache.raw === raw) return cache.items;

  let items: WishlistItem[] = EMPTY;
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

function writeWishlist(items: WishlistItem[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage indisponible (navigation privée...) : les favoris ne
    // persistent pas au rechargement, mais l'ajout ne plante pas.
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

export function useWishlist() {
  const items = useSyncExternalStore(subscribe, readWishlist, getServerSnapshot);

  const isFavorite = useCallback(
    (productId: string) => readWishlist().some((i) => i.productId === productId),
    []
  );

  const toggle = useCallback((item: WishlistItem) => {
    const current = readWishlist();
    const exists = current.some((i) => i.productId === item.productId);
    writeWishlist(
      exists ? current.filter((i) => i.productId !== item.productId) : [...current, item]
    );
  }, []);

  const remove = useCallback((productId: string) => {
    writeWishlist(readWishlist().filter((i) => i.productId !== productId));
  }, []);

  return { items, isFavorite, toggle, remove, count: items.length };
}
