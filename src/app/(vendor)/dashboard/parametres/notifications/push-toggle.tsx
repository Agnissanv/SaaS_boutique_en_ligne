"use client";

import { useEffect, useState } from "react";
import { subscribeToPush, unsubscribeFromPush } from "./push-actions";

/**
 * Interrupteur "Notifications sur cet appareil" (Web Push) — ajouté le
 * 01/10/2026, demande d'Isaac : les vendeurs doivent pouvoir recevoir une
 * notification même quand ils ne sont pas sur le site/l'app KEVA. Voir
 * send-push.ts et decisions-techniques.md pour l'architecture complète.
 *
 * Contrairement à `NotificationEmailForm` (juste à côté), DISPONIBLE SUR TOUS
 * LES PLANS, pas seulement Business+ : le push est gratuit à l'usage (aucun
 * quota d'envoi à ménager, contrairement à Brevo pour l'email), donc aucune
 * raison de le réserver à un palier payant.
 *
 * État "activé" déterminé en interrogeant directement le navigateur
 * (`pushManager.getSubscription()`) plutôt qu'une donnée venue du serveur :
 * un abonnement push est propre à CET appareil/navigateur précis, une info
 * côté serveur ("le vendeur a au moins un abonnement quelque part") ne dirait
 * pas si CET appareil-ci est abonné.
 */
export function PushNotificationToggle({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setSupported(true);
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setEnabled(Boolean(subscription)))
      .catch(() => {});
  }, []);

  async function handleEnable() {
    setError(null);
    setPending(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Autorise les notifications dans ton navigateur pour activer cette option.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const key = subscription.toJSON();
      const result = await subscribeToPush({
        endpoint: subscription.endpoint,
        p256dh: key.keys?.p256dh ?? "",
        auth: key.keys?.auth ?? "",
      });

      if (result.error) {
        setError(result.error);
        return;
      }
      setEnabled(true);
    } catch {
      setError("Impossible d'activer les notifications sur cet appareil. Réessaie.");
    } finally {
      setPending(false);
    }
  }

  async function handleDisable() {
    setError(null);
    setPending(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await unsubscribeFromPush(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setEnabled(false);
    } catch {
      setError("Échec de la désactivation. Réessaie.");
    } finally {
      setPending(false);
    }
  }

  if (!supported) {
    return (
      <p className="mt-4 max-w-md text-xs text-encre/50">
        Les notifications sur cet appareil ne sont pas prises en charge par ce
        navigateur. Sur iPhone, installe d&apos;abord KEVA sur ton écran
        d&apos;accueil (Safari &gt; Partager &gt; Sur l&apos;écran d&apos;accueil).
      </p>
    );
  }

  return (
    <div className="mt-3 flex max-w-md flex-col gap-2">
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm">
          <span className="font-medium text-encre">Notifications sur cet appareil</span>
          <span className="mt-0.5 block text-xs text-encre/50">
            Reçois une alerte même quand KEVA n&apos;est pas ouvert — nouvelle
            commande, annulation, messages KEVA.
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={pending}
          onClick={enabled ? handleDisable : handleEnable}
          className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${
            enabled ? "bg-vert-actif" : "bg-ligne"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
              enabled ? "left-5" : "left-0.5"
            }`}
          />
        </button>
      </label>
      {error && <p className="text-xs text-erreur">{error}</p>}
    </div>
  );
}

/**
 * Conversion standard base64url -> Uint8Array pour `applicationServerKey`.
 *
 * Retour explicitement typé `Uint8Array<ArrayBuffer>` (01/10/2026, build
 * Vercel cassé) : sans ce paramètre, l'annotation `: Uint8Array` résout au
 * générique par défaut `Uint8Array<ArrayBufferLike>` (TypeScript 5.7+,
 * `Uint8Array` devenu générique) — qui inclut `SharedArrayBuffer` et n'est
 * donc plus assignable à `BufferSource`/`applicationServerKey` sur
 * `PushSubscriptionOptionsInit`. `new Uint8Array(n)` est déjà backé par un
 * vrai `ArrayBuffer`, seule l'annotation de retour avait besoin d'être
 * précisée.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
