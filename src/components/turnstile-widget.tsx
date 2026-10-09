"use client";

import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      "before-interactive-callback"?: () => void;
      "after-interactive-callback"?: () => void;
      language?: string;
      theme?: "light" | "dark" | "auto";
      appearance?: "always" | "execute" | "interaction-only";
    }
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;

/** Charge le script Turnstile une seule fois pour toute la page. */
function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error("Turnstile n'a pas pu être chargé"));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

/**
 * Widget anti-robot Cloudflare Turnstile (09/10/2026, voir
 * `verifyCheckoutCaptcha` et la migration 0059). Mode « interaction-only » :
 * invisible pour la grande majorité des visiteurs, une case à cocher
 * n'apparaît que si Cloudflare a un doute ; `onInteractiveChange(true)` prévient
 * alors le parent qu'il faut la cocher. Thème clair forcé : le thème "auto"
 * suivait le réglage sombre de l'ordinateur et détonnait sur le site.
 *
 * Un jeton n'est valable qu'une fois : le parent incrémente `resetKey` après
 * chaque tentative de commande pour en obtenir un nouveau.
 */
export function TurnstileWidget({
  siteKey,
  resetKey,
  onToken,
  onLoadError,
  onInteractiveChange,
}: {
  siteKey: string;
  resetKey: number;
  onToken: (token: string | null) => void;
  onLoadError?: () => void;
  onInteractiveChange?: (needsInteraction: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  // Callbacks lus via des refs : le widget n'est rendu qu'une fois, il doit
  // toujours appeler la version la plus récente fournie par le parent.
  const onTokenRef = useRef(onToken);
  const onLoadErrorRef = useRef(onLoadError);
  const onInteractiveChangeRef = useRef(onInteractiveChange);
  useEffect(() => {
    onTokenRef.current = onToken;
    onLoadErrorRef.current = onLoadError;
    onInteractiveChangeRef.current = onInteractiveChange;
  });

  useEffect(() => {
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
          "before-interactive-callback": () => onInteractiveChangeRef.current?.(true),
          "after-interactive-callback": () => onInteractiveChangeRef.current?.(false),
          language: "fr",
          appearance: "interaction-only",
          theme: "light",
        });
      })
      .catch(() => {
        if (!cancelled) onLoadErrorRef.current?.();
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetKey > 0 && widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [resetKey]);

  return <div ref={containerRef} />;
}
