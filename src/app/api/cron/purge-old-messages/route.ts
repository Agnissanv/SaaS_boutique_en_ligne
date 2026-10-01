import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { MESSAGE_RETENTION_DAYS } from "@/lib/message-retention";

/**
 * Tâche planifiée (Vercel Cron, voir vercel.json — une fois par jour, même
 * fréquence que subscription-lifecycle, migration 0029) qui purge les
 * messages/notifications plus vieux que `MESSAGE_RETENTION_DAYS` (90 jours
 * par défaut) — demande d'Isaac du 01/10/2026 : "si un message... fait
 * environ trois mois, il disparaît, pour ne pas saturer la base de données".
 *
 * Trois tables concernées ("tout ce qui est comme message ou notification") :
 * - `notifications` (commandes, annulations, messages admin → boutique/client)
 * - `contact_messages` (formulaire "Nous contacter", traités ou non)
 * - `admin_notification_campaigns` (historique des envois admin, migration 0053)
 *
 * Suppression inconditionnelle au-delà du seuil (lu ou non, traité ou non) :
 * c'est la lecture la plus simple de la demande d'Isaac ("peu importe"), et
 * cohérente avec le principe déjà appliqué ailleurs dans le projet de ne pas
 * sur-complexifier une règle de nettoyage.
 *
 * Même garde-fou `CRON_SECRET` que subscription-lifecycle (voir ce fichier) :
 * Vercel ajoute automatiquement l'en-tête `Authorization: Bearer
 * <CRON_SECRET>` sur ses propres appels, revérifié ici pour ne jamais faire
 * confiance à un appel entrant sans le vérifier.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const cutoff = new Date(
    Date.now() - MESSAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const [notifications, contactMessages, campaigns] = await Promise.all([
    supabase.from("notifications").delete().lt("created_at", cutoff).select("id"),
    supabase.from("contact_messages").delete().lt("created_at", cutoff).select("id"),
    supabase.from("admin_notification_campaigns").delete().lt("created_at", cutoff).select("id"),
  ]);

  const errors = [notifications.error, contactMessages.error, campaigns.error].filter(Boolean);
  if (errors.length > 0) {
    console.error("purge-old-messages cron — erreurs:", errors);
  }

  return NextResponse.json({
    retentionDays: MESSAGE_RETENTION_DAYS,
    deleted: {
      notifications: notifications.data?.length ?? 0,
      contactMessages: contactMessages.data?.length ?? 0,
      campaigns: campaigns.data?.length ?? 0,
    },
    errors: errors.length > 0 ? errors : undefined,
  });
}
