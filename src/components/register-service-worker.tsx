"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker PWA côté client.
 * À monter une fois dans le layout racine.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("Échec d'enregistrement du service worker :", error);
      });
    }
  }, []);

  return null;
}
