"use client";

import { useCallback, useSyncExternalStore } from "react";

export type CartItem = {
  /** Combine product_id + variant_ids (triés) : deux lignes différentes si combinaison différente. */
  key: string;
  productId: string;
  productSlug: string;
  title: string;
  price: number;
  imageUrl?: string;
  /** Une variante par groupe (ex: une Taille ET une Couleur), pas une seule au total — cf. migration 0010. */
  variantIds?: string[];
  /** Libellé combiné pour l'affichage, ex: "Taille: XL, Couleur: Rouge". */
  variantLabel?: string;
  quantity: number;
};

/**
 * Panier client, un par boutique (localStorage, pas de compte client — voir
 * cahier des charges §3.1.B). Une commande porte sur une seule boutique
 * (orders.shop_id), donc le panier est scopé par shopSlug plutôt que global.
 *
 * Volontairement en localStorage plutôt qu'en base : pas de notion de
 * "session panier" côté serveur pour un visiteur anonyme, et ça évite
 * d'écrire des lignes en base avant que la commande soit réellement passée.
 *
 * Lu via `useSyncExternalStore` plutôt qu'un `useState` + `useEffect` : le
 * panier est un store externe (localStorage), pas un dérivé de props/state
 * React — ça évite un mismatch d'hydratation (le serveur n'a pas accès au
 * localStorage) et permet à plusieurs composants montés en même temps
 * (ex: le formulaire produit et l'indicateur de panier) de rester synchronisés
 * dès qu'un panier change quelque part sur la page.
 */

const EMPTY: CartItem[] = [];
const listeners = new Map<string, Set<() => void>>();
// Cache par boutique de la dernière valeur brute lue en localStorage et du
// tableau qui en a été dérivé. Indispensable pour `useSyncExternalStore` :
// son `getSnapshot` DOIT renvoyer la même référence tant que la donnée
// sous-jacente n'a pas changé, sinon React détecte un nouveau rendu à
// chaque appel et boucle ("The result of getSnapshot should be cached...",
// puis "Maximum update depth exceeded"). Sans ce cache, `JSON.parse`
// fabriquait un nouveau tableau à chaque lecture même quand le contenu
// était identique.
const cartCache = new Map<string, { raw: string | null; items: CartItem[] }>();

function storageKey(shopSlug: string) {
  return `cart:${shopSlug}`;
}

function readCart(shopSlug: string): CartItem[] {
  if (typeof window === "undefined") return EMPTY;

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(storageKey(shopSlug));
  } catch {
    raw = null;
  }

  const cached = cartCache.get(shopSlug);
  if (cached && cached.raw === raw) {
    return cached.items;
  }

  let items: CartItem[] = EMPTY;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) items = parsed;
    } catch {
      items = EMPTY;
    }
  }

  cartCache.set(shopSlug, { raw, items });
  return items;
}

function notify(shopSlug: string) {
  listeners.get(shopSlug)?.forEach((cb) => cb());
}

function writeCart(shopSlug: string, items: CartItem[]) {
  try {
    window.localStorage.setItem(storageKey(shopSlug), JSON.stringify(items));
  } catch {
    // localStorage indisponible (navigation privée...) : le panier ne
    // persiste pas au rechargement, mais l'ajout au panier ne plante pas.
  }
  notify(shopSlug);
}

function subscribe(shopSlug: string, callback: () => void) {
  let set = listeners.get(shopSlug);
  if (!set) {
    set = new Set();
    listeners.set(shopSlug, set);
  }
  set.add(callback);

  // Synchronise aussi entre onglets (l'événement "storage" ne se déclenche
  // que dans les AUTRES onglets, jamais dans celui qui a écrit).
  const onStorage = (e: StorageEvent) => {
    if (e.key === storageKey(shopSlug)) callback();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    set!.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

function getServerSnapshot() {
  return EMPTY;
}

export function useShopCart(shopSlug: string) {
  const items = useSyncExternalStore(
    useCallback((callback) => subscribe(shopSlug, callback), [shopSlug]),
    useCallback(() => readCart(shopSlug), [shopSlug]),
    getServerSnapshot
  );

  const addItem = useCallback(
    (item: Omit<CartItem, "key">) => {
      // Triées pour que l'ordre de sélection (Taille puis Couleur, ou
      // l'inverse) ne crée pas deux lignes de panier pour la même combinaison.
      const key =
        item.variantIds && item.variantIds.length > 0
          ? `${item.productId}:${[...item.variantIds].sort().join(",")}`
          : item.productId;
      const current = readCart(shopSlug);
      const existing = current.find((i) => i.key === key);
      const next = existing
        ? current.map((i) =>
            i.key === key ? { ...i, quantity: i.quantity + item.quantity } : i
          )
        : [...current, { ...item, key }];
      writeCart(shopSlug, next);
    },
    [shopSlug]
  );

  const updateQuantity = useCallback(
    (key: string, quantity: number) => {
      const current = readCart(shopSlug);
      const next =
        quantity <= 0
          ? current.filter((i) => i.key !== key)
          : current.map((i) => (i.key === key ? { ...i, quantity } : i));
      writeCart(shopSlug, next);
    },
    [shopSlug]
  );

  const removeItem = useCallback(
    (key: string) => {
      writeCart(shopSlug, readCart(shopSlug).filter((i) => i.key !== key));
    },
    [shopSlug]
  );

  const clear = useCallback(() => {
    writeCart(shopSlug, []);
  }, [shopSlug]);

  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return { items, addItem, updateQuantity, removeItem, clear, count, total };
}
