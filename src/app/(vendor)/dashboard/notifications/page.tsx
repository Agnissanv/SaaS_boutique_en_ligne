import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  NOTIFICATION_KIND_BADGE_CLASS,
  NOTIFICATION_KIND_LABEL,
  type NotificationKind,
} from "@/lib/notifications";

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  kind: string;
  is_read: boolean;
  created_at: string;
};

/**
 * Espace de notification du dashboard vendeur — créé le 21/09/2026, demande
 * d'Isaac : la seule "notification" existant jusqu'ici était le pastille de
 * commandes en attente sur la cloche du header ("un espace notification qui
 * concerne seulement les commandes... je veux un vrai espace notification
 * qui concerne tout"). Remplace ce comportement : la cloche (layout.tsx)
 * pointe maintenant ici plutôt que directement vers /dashboard/commandes,
 * et affiche le nombre de notifications non lues plutôt que le nombre de
 * commandes en attente.
 *
 * Marquage "lu" : au chargement de la page plutôt qu'un bouton par ligne
 * (plus simple, comportement standard d'un centre de notifications basique)
 * — mais on calcule d'abord `wasUnread` à partir des lignes lues AVANT la
 * mise à jour, pour que la page affiche encore l'état "non lu" au moment où
 * le vendeur les découvre, pas déjà "lu" avant même qu'il les ait vues.
 */
export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/connexion");

  const { data } = await supabase
    .from("notifications")
    .select("id, title, body, link, kind, is_read, created_at")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const notifications = (data ?? []) as NotificationRow[];
  const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);

  if (unreadIds.length > 0) {
    await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
  }

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Notifications</h1>
      <p className="mt-1 text-sm text-encre/70">
        Nouvelles commandes, annulations et changements liés à ta boutique.
      </p>

      {notifications.length === 0 ? (
        <p className="mt-6 rounded-lg border border-ligne bg-white p-4 text-sm text-encre/60">
          Aucune notification pour l&apos;instant.
        </p>
      ) : (
        <ul className="mt-4 overflow-hidden rounded-lg border border-ligne bg-white">
          {notifications.map((n) => {
            const wasUnread = unreadIds.includes(n.id);
            const kind = (n.kind as NotificationKind) ?? "info";
            const content = (
              <div
                className={`flex items-start gap-3 border-b border-ligne px-4 py-3.5 last:border-0 ${
                  wasUnread ? "bg-vert-actif/5" : ""
                }`}
              >
                <span
                  className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${
                    NOTIFICATION_KIND_BADGE_CLASS[kind] ?? "bg-sable text-encre/60"
                  }`}
                >
                  {NOTIFICATION_KIND_LABEL[kind] ?? "Info"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm text-encre ${wasUnread ? "font-medium" : ""}`}>{n.title}</p>
                  {n.body && <p className="mt-0.5 text-sm text-encre/60">{n.body}</p>}
                  <p className="mt-1 text-xs text-encre/40">
                    {new Date(n.created_at).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                {wasUnread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cuivre-profond" />}
              </div>
            );

            return (
              <li key={n.id}>
                {n.link ? (
                  <Link href={n.link} className="block transition-colors hover:bg-brume/50">
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
