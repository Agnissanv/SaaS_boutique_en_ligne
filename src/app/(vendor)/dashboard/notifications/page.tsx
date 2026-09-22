import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  NOTIFICATION_KIND_BADGE_CLASS,
  NOTIFICATION_KIND_LABEL,
  type NotificationKind,
} from "@/lib/notifications";
import { MarkNotificationsRead } from "./mark-read";

const PAGE_SIZE = 50;

type ReadFilter = "all" | "unread";

const READ_TABS: { value: ReadFilter; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "unread", label: "Non lues" },
];

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
 *
 * Écriture déplacée dans `mark-read.tsx` (Client Component) le 22/09/2026
 * (audit pré-lancement) : elle se faisait jusqu'ici directement dans ce rendu
 * serveur, or le lien de la cloche vers cette page est présent dans le
 * header de TOUT le dashboard (`layout.tsx`) — le prefetch automatique des
 * liens visibles de Next.js suffisait à exécuter ce rendu, et donc à
 * marquer les notifications comme lues, sans que le vendeur n'ouvre jamais
 * la page. `wasUnread` (affichage) reste calculé ici à partir des données
 * lues, avant toute écriture.
 *
 * **Filtre "non lues" + pagination ajoutés le 22/09/2026** (audit "filtres
 * partout" d'Isaac) : le plafond fixe de 50 (`\.limit(50)`) n'offrait aucun
 * moyen d'aller voir plus loin. Passé en vraie pagination 50/page + un
 * filtre "non lues" pour retrouver vite ce qui n'a pas encore été vu.
 */
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string; page?: string }>;
}) {
  const { filtre, page: pageParam } = await searchParams;
  const readFilter: ReadFilter = filtre === "unread" ? "unread" : "all";
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/connexion");

  let query = supabase
    .from("notifications")
    .select("id, title, body, link, kind, is_read, created_at", { count: "exact" })
    .eq("profile_id", user.id);

  if (readFilter === "unread") query = query.eq("is_read", false);

  const { data, count } = await query.order("created_at", { ascending: false }).range(from, to);

  const notifications = (data ?? []) as NotificationRow[];
  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;
  const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);

  return (
    <div>
      <MarkNotificationsRead ids={unreadIds} />
      <h1 className="font-display text-lg font-semibold text-encre">Notifications</h1>
      <p className="mt-1 text-sm text-encre/70">
        Nouvelles commandes, annulations et changements liés à ta boutique.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {READ_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value === "all" ? "/dashboard/notifications" : `/dashboard/notifications?filtre=${tab.value}`}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              readFilter === tab.value
                ? "border-vert-actif bg-vert-actif/10 font-medium text-vert-sapin"
                : "border-ligne text-encre/70 hover:border-vert-actif"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {notifications.length === 0 ? (
        <p className="mt-6 rounded-lg border border-ligne bg-white p-4 text-sm text-encre/60">
          {readFilter === "unread"
            ? "Aucune notification non lue."
            : "Aucune notification pour l'instant."}
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

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm">
          {page > 1 ? (
            <Link
              href={`/dashboard/notifications?${new URLSearchParams({ ...(readFilter === "unread" ? { filtre: "unread" } : {}), page: String(page - 1) })}`}
              className="rounded-md border border-ligne px-3 py-1.5 text-encre transition hover:border-vert-actif"
            >
              ‹ Précédent
            </Link>
          ) : (
            <span className="rounded-md border border-ligne px-3 py-1.5 text-encre/30">‹ Précédent</span>
          )}
          <span className="px-2 font-mono text-encre/70">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={`/dashboard/notifications?${new URLSearchParams({ ...(readFilter === "unread" ? { filtre: "unread" } : {}), page: String(page + 1) })}`}
              className="rounded-md border border-ligne px-3 py-1.5 text-encre transition hover:border-vert-actif"
            >
              Suivant ›
            </Link>
          ) : (
            <span className="rounded-md border border-ligne px-3 py-1.5 text-encre/30">Suivant ›</span>
          )}
        </div>
      )}
    </div>
  );
}
