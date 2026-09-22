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
 * Espace de notification du compte client — créé le 21/09/2026, pendant du
 * même chantier côté dashboard vendeur. Alimenté par
 * `dashboard/commandes/actions.ts` (changement de statut, avis possible une
 * fois la commande livrée) — uniquement pour les commandes rattachées à ce
 * compte (`orders.customer_id`), ce qui n'arrive que si le client était
 * connecté au moment de sa commande, ou l'a rattachée ensuite (voir
 * `claim_guest_orders` / la bannière proposée sur la page de confirmation de
 * commande). Un client invité sans compte ne peut pas recevoir de
 * notification ici — juste un argument de plus en faveur de créer un compte.
 *
 * Remplace le lien "Notifications" déjà présent (mais menant à
 * /compte/profil, un stub) dans la section "Mon compte" de `/compte`.
 */
export default async function CustomerNotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/compte/connexion");

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
    <div className="mx-auto w-full max-w-lg">
      <Link
        href="/compte"
        className="mb-5 inline-flex items-center gap-1 text-sm text-encre/60 hover:text-vert-actif"
      >
        ‹ Retour
      </Link>

      <h1 className="font-display text-xl font-semibold text-encre">Notifications</h1>
      <p className="mt-1 text-sm text-encre/65">
        Suivi de tes commandes : statut, livraison, et quand tu peux laisser
        un avis.
      </p>

      {notifications.length === 0 ? (
        <p className="mt-6 rounded-xl border border-ligne bg-white p-4 text-sm text-encre/70">
          Aucune notification pour l&apos;instant.
        </p>
      ) : (
        <ul className="mt-6 overflow-hidden rounded-xl border border-ligne bg-white">
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
                    NOTIFICATION_KIND_BADGE_CLASS[kind] ?? "bg-brume text-encre/60"
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
                {wasUnread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-vert-actif" />}
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
