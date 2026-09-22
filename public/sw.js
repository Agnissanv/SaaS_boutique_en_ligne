// Service worker KEVA — installabilité PWA + résilience réseau mobile.
//
// Portée volontairement limitée (cahier des charges §9 : "la connexion
// internet peut être instable → prévoir des états de chargement et
// retries", pas "l'app doit marcher hors-ligne comme une vraie appli
// offline-first") :
//
//   1. Les fichiers HASHÉS du build Next.js (JS/CSS sous /_next/static/ —
//      leur nom change à chaque build, donc jamais besoin de revérifier)
//      passent en cache-first pur : chargement instantané, fonctionnent
//      même en coupure réseau.
//   2. Le logo, les icônes PWA et les autres images (même nom de fichier
//      d'une fois sur l'autre, contenu qui PEUT changer — voir bug du
//      22/09/2026 ci-dessous) passent en "stale-while-revalidate" plutôt
//      qu'en cache-first pur depuis cette date : la version en cache est
//      renvoyée immédiatement (rapide, marche hors-ligne), mais une requête
//      réseau part quand même en tâche de fond pour rafraîchir le cache —
//      au chargement suivant, la version à jour est déjà là.
//   3. Les pages (navigation) passent en network-first : jamais de contenu
//      figé pour du stock, un prix ou une commande — en cas d'échec réseau
//      uniquement, on retombe sur /offline.html plutôt que l'écran d'erreur
//      générique de Chrome.
//   4. Tout le reste (API Supabase, requêtes non-GET) n'est JAMAIS
//      intercepté : ces appels doivent réussir ou échouer normalement, pas
//      recevoir une réponse mise en cache qui mentirait sur un stock ou une
//      commande.
//
// Bug corrigé le 22/09/2026 : le point 2 ci-dessus était jusqu'ici en
// cache-first pur, comme les fichiers hashés du point 1. Isaac a remplacé
// `keva-logo.jpg` et les fichiers sous `/icons/` (même noms de fichiers,
// nouveau contenu) sans jamais voir le changement — normal, un cache-first
// pur sert indéfiniment la première version mise en cache tant que rien ne
// vide explicitement ce cache, un hard refresh classique ne suffit pas à
// contourner un Service Worker actif. `CACHE_VERSION` bumpé une fois pour
// purger le cache déjà pollué par l'ancien logo/icônes, ET stratégie
// changée en stale-while-revalidate pour que le même problème ne se
// reproduise pas la prochaine fois qu'Isaac remplace ces fichiers.
const CACHE_VERSION = "keva-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const APP_SHELL = ["/offline.html", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key.startsWith("keva-") && key !== STATIC_CACHE).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fichiers hashés du build Next.js : le nom change à chaque build, donc un
// nom déjà en cache pointe forcément vers le même contenu pour toujours —
// cache-first pur reste correct et optimal ici.
function isImmutableAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

// Logo, icônes PWA, autres images : même nom de fichier d'une fois sur
// l'autre, mais le CONTENU peut changer (Isaac remplace son logo, une
// icône...) — voir le commentaire d'en-tête du 22/09/2026. Ne jamais mettre
// en cache-first pur ces URLs.
function isRevalidatableAsset(url) {
  return (
    url.pathname.startsWith("/icons/") ||
    /\.(?:png|jpg|jpeg|svg|webp|gif|ico|woff2?)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Jamais d'interception hors même origine (Supabase, CinetPay, etc.) ni
  // des requêtes non-GET (mutations) — voir le commentaire d'en-tête.
  if (url.origin !== self.location.origin || request.method !== "GET") {
    return;
  }

  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  if (isRevalidatableAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);

        // Requête réseau lancée dans tous les cas, pour rafraîchir le cache —
        // détachée de `event.respondWith` via `waitUntil` pour qu'elle ait le
        // temps de se terminer même si on répond déjà avec `cached` ci-dessous.
        const networkUpdate = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => null);

        if (cached) {
          event.waitUntil(networkUpdate);
          return cached;
        }

        // Rien en cache pour l'instant : on attend le réseau, mêmes garanties
        // qu'avant (marche hors-ligne dès la 2e visite, une fois mis en cache).
        const fresh = await networkUpdate;
        return fresh ?? Response.error();
      })
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html").then((r) => r ?? Response.error()))
    );
  }
});
