// Service worker minimal — installabilité PWA uniquement pour l'instant.
// Pas de cache offline agressif tant que le contenu boutique (produits,
// commandes) change en permanence : à affiner plus tard (cache statique
// des assets, stratégie network-first pour les données).

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Pas d'interception pour l'instant — laisse passer toutes les requêtes.
});
