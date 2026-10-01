import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendPushToProfile } from "@/lib/push/send-push";

// Route Node (jamais Edge) — `node:crypto` pour la comparaison du secret, et
// `web-push` (via send-push.ts) nécessite aussi l'environnement Node.
export const runtime = "nodejs";

/**
 * Point d'entrée appelé par le trigger `pg_net` posé sur `notifications`
 * (migration 0052) à chaque notification créée (nouvelle commande,
 * annulation, avis possible, message KEVA...) — voir ce trigger pour le
 * contexte complet : `notifications` est alimentée par des inserts SQL
 * directs à l'intérieur de fonctions `security definer`, pas par un point de
 * passage JS unique, d'où ce webhook interne plutôt qu'un appel direct à
 * `sendPushToProfile` depuis le code qui crée chaque notification.
 *
 * Route serveur-à-serveur (pas de session utilisateur) : authentifiée par un
 * secret partagé (`x-push-secret`, recopié en dur dans le trigger SQL — voir
 * migration 0052 et .env.example) plutôt que par les cookies de session,
 * même principe que les webhooks de paiement (Nyole) déjà présents dans le
 * projet. Comparaison en temps constant (`timingSafeEqual`), même rigueur
 * que `verifyNyoleWebhookSignature` (src/lib/nyole.ts).
 *
 * Best-effort de bout en bout : jamais d'erreur ne doit remonter jusqu'à la
 * transaction Postgres qui a déclenché cet appel (le trigger lui-même est
 * déjà enveloppé dans un `exception when others`, voir migration 0052) —
 * cette route répond toujours 200, même en cas d'échec interne, pour ne
 * jamais pousser `pg_net` à retenter inutilement un envoi déjà tenté.
 */
export async function POST(request: NextRequest) {
  const expected = process.env.PUSH_INTERNAL_SECRET ?? "";
  const provided = request.headers.get("x-push-secret") ?? "";
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  const isValid =
    expected.length > 0 &&
    expectedBuf.length === providedBuf.length &&
    timingSafeEqual(expectedBuf, providedBuf);

  if (!isValid) {
    return NextResponse.json({ error: "Secret invalide" }, { status: 401 });
  }

  try {
    const { notification_id: notificationId } = (await request.json()) as {
      notification_id?: string;
    };
    if (!notificationId) {
      return NextResponse.json({ ok: true });
    }

    const supabase = createServiceRoleClient();
    const { data: notification } = await supabase
      .from("notifications")
      .select("profile_id, title, body, link")
      .eq("id", notificationId)
      .maybeSingle();

    if (notification) {
      await sendPushToProfile(notification.profile_id, {
        title: notification.title,
        body: notification.body ?? "",
        link: notification.link ?? "/dashboard/notifications",
      });
    }
  } catch (error) {
    console.error("/api/push/trigger — erreur:", error);
  }

  return NextResponse.json({ ok: true });
}
