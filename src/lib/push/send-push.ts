import webpush from "web-push";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Envoi de notifications push (Web Push API) — ajouté le 01/10/2026, demande
 * d'Isaac : les vendeurs doivent recevoir une notification même hors du
 * site/app. Voir migration 0052 (table `push_subscriptions`, trigger
 * `pg_net` sur `notifications`) et /api/push/trigger (point d'entrée appelé
 * par ce trigger) pour le reste de la chaîne.
 *
 * Gratuit, aucun service tiers à payer : `web-push` parle directement le
 * protocole standard des navigateurs (Push API + VAPID), les clés VAPID sont
 * auto-générées (voir .env.example) plutôt qu'une clé d'API à obtenir
 * ailleurs. iOS/Safari : fonctionne par le même protocole depuis iOS 16.4,
 * MAIS seulement si le vendeur a installé KEVA sur son écran d'accueil
 * (limite d'Apple, pas de KEVA — déjà signalée par Isaac lui-même).
 *
 * Appel gardé par un `if` (01/10/2026, build Vercel cassé) : `web-push`
 * valide ses clés immédiatement et LÈVE si la clé publique est vide —
 * `setVapidDetails` tournait ici à l'IMPORT du module (donc dès que Next
 * charge /api/push/trigger, y compris pendant `next build` qui "collecte" la
 * route), sans attendre `sendPushToProfile`. Tant que les variables VAPID_*
 * ne sont pas encore renseignées sur Vercel (Paramètres du projet >
 * Environment Variables — `.env.local` seul ne suffit pas, il ne vaut que
 * pour la machine d'Isaac), ça faisait planter le build en entier plutôt que
 * de juste désactiver le push. Le garde-fou de `sendPushToProfile` plus bas
 * (clés manquantes → abandon silencieux) ne protégeait pas de ça : il
 * s'exécute après, à l'appel de la fonction, jamais à l'import du module.
 */
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:contact@shopkeva.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export type PushPayload = {
  title: string;
  body: string;
  link: string;
};

/**
 * Envoie `payload` à TOUS les abonnements push du profil donné (un par
 * appareil/navigateur où il a activé les notifications) — un vendeur peut
 * avoir son téléphone ET son ordinateur abonnés, les deux reçoivent la
 * notification. Best-effort et non bloquant, même philosophie que le reste
 * du projet (emails/SMS) : une erreur sur un abonnement ne doit jamais
 * empêcher l'envoi aux autres, ni faire planter l'appelant.
 *
 * Nettoyage automatique : un abonnement qui répond 404/410 (navigateur
 * désinstallé, permission retirée, etc. — codes documentés par la spec Push
 * API) est définitivement mort côté navigateur, jamais réutilisable — on le
 * supprime de `push_subscriptions` plutôt que de retenter indéfiniment dans
 * le vide à chaque future notification.
 */
export async function sendPushToProfile(profileId: string, payload: PushPayload): Promise<void> {
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_PUBLIC_KEY) {
    // Clés VAPID absentes (projet pas encore configuré, ou `.env.local`
    // incomplet) — best-effort, on abandonne silencieusement plutôt que de
    // faire échouer la route qui appelle cette fonction.
    console.error("sendPushToProfile: clés VAPID manquantes (.env.local).");
    return;
  }

  const supabase = createServiceRoleClient();
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("profile_id", profileId);

  if (!subscriptions || subscriptions.length === 0) return;

  const body = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("sendPushToProfile: échec d'envoi", sub.id, error);
        }
      }
    })
  );
}
