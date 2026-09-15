"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Dernière boutique visitée par le client (localStorage, une seule clé
 * globale) — ajouté le 15/09/2026 (chantier responsive design, barre de
 * navigation basse). Sert uniquement à donner une destination utile à
 * l'onglet "Panier" de <BottomNav> quand le client n'est pas actuellement
 * sur une page boutique : notre panier est scopé PAR BOUTIQUE (voir
 * useShopCart.ts — une commande porte sur une seule boutique), contrairement
 * à un panier global façon Jumia. Cette valeur permet quand même de proposer
 * un raccourci pertinent (la dernière boutique visitée) plutôt qu'un onglet
 * mort en dehors d'une page boutique.
 *
 * Même pattern que useWishlist.ts (useSyncExternalStore, clé globale
 * unique) — pas de cache de référence nécessaire ici (contrairement aux
 * tableaux JSON.parse des deux autres stores) : une chaîne de caractères
 * primitive satisfait déjà Object.is quand son contenu est identique.
 */

const STORAGE_KEY = "lastShop";
const listeners = new Set<() => void>();

function read(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function notify() {
  listeners.forEach((cb) => cb());
}

function write(shopSlug: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, shopSlug);
  } catch {
    // localStorage indisponible (navigation privée...) : le raccourci ne
    // persiste pas, sans impact fonctionnel (le panier reste accessible via
    // le lien direct /<shopSlug>/panier).
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
  return null;
}

export function useLastVisitedShop() {
  const shopSlug = useSyncExternalStore(subscribe, read, getServerSnapshot);

  const setShopSlug = useCallback((slug: string) => {
    if (read() !== slug) write(slug);
  }, []);

  return { shopSlug, setShopSlug };
}
