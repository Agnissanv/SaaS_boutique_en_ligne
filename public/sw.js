// Service worker KEVA — installabilité PWA + résilience réseau mobile.
//
// Portée volontairement limitée (cahier des charges §9 : "la connexion
// internet peut être instable → prévoir des états de chargement et
// retries", pas "l'app doit marcher hors-ligne comme une vraie appli
// offline-first") :
//
//   1. Les fichiers statiques du build Next.js (JS/CSS sous /_next/static/,
//      immuables — leur nom change à chaque build) et les images passent en
//      cache-first : chargement instantané au retour sur l'app, et
//      fonctionnent même en coupure réseau.
//   2. Les pages (navigation) passent en network-first : jamais de contenu
//      figé pour du stock, un prix ou une commande — en cas d'échec réseau
//      uniquement, on retombe sur /offline.html plutôt que l'écran d'erreur
//      générique de Chrome.
//   3. Tout le reste (API Supabase, requêtes non-GET) n'est JAMAIS
//      intercepté : ces appels doivent réussir ou échouer normalement, pas
//      recevoir une réponse mise en cache qui mentirait sur un stock ou une
//      commande.
//
// CACHE_VERSION à incrémenter uniquement si une purge complète du cache
// statique devient nécessaire (changement de stratégie, bug de cache) — les
// noms de fichiers hashés du build Next.js rendent ça rare en pratique.
const CACHE_VERSION = "keva-v1";
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

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
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

  if (isStaticAsset(url)) {
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

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html").then((r) => r ?? Response.error()))
    );
  }
});
