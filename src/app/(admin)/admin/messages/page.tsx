import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MailIcon } from "@/components/admin/admin-icons";
import { MessageStatusButton } from "./message-status-button";

const PAGE_SIZE = 50;

type ContactMessageRow = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
};

const STATUS_TABS: { value: "all" | "new" | "handled"; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "new", label: "Nouveaux" },
  { value: "handled", label: "Traités" },
];

/**
 * Messages du formulaire "Nous contacter" (ajouté le 22/09/2026, audit
 * back-office — voir decisions-techniques.md). Jusqu'ici ces messages
 * n'existaient que sous forme d'email envoyé via Brevo, sans aucune trace en
 * base ; cette page lit `contact_messages`, la copie de référence désormais
 * écrite par `src/app/contact/actions.ts` avant même l'envoi de l'email.
 *
 * Pas de vrai système de tickets (assignation, réponses threadées) — même
 * simplification assumée que le "Support basique" note-libre de
 * /admin/vendeurs (cahier des charges §3.1.C.5) : juste de quoi ne plus
 * jamais perdre un message et savoir ce qui a déjà été traité. Répondre se
 * fait toujours par email classique (lien "Répondre" ci-dessous), pas dans
 * l'app.
 */
export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { status: statusParam, page: pageParam } = await searchParams;
  const status = statusParam === "new" || statusParam === "handled" ? statusParam : "all";
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  let query = supabase
    .from("contact_messages")
    .select("id, name, email, subject, message, status, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data: messages, count, error } = await query;
  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Messages</h1>
      <p className="mt-1 text-sm text-encre/70">
        Messages envoyés depuis le formulaire &laquo;&nbsp;Nous contacter&nbsp;&raquo;. Réponds
        directement par email — cette page sert à ne pas en perdre un et à suivre ce qui reste
        à traiter.
      </p>

      <div className="mt-4 flex gap-2">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value === "all" ? "/admin/messages" : `/admin/messages?status=${tab.value}`}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              status === tab.value
                ? "border-vert-actif bg-vert-actif/10 font-medium text-vert-sapin"
                : "border-ligne text-encre/70 hover:border-vert-actif"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-erreur/30 bg-erreur/5 px-3 py-2 text-sm text-erreur">
          Impossible de charger les messages pour l&apos;instant. Réessaie dans un instant.
        </p>
      )}

      {!error && (messages ?? []).length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-lg border border-dashed border-ligne bg-white py-12 text-center">
          <MailIcon className="h-8 w-8 text-encre/30" />
          <p className="text-sm text-encre/60">Aucun message ici.</p>
        </div>
      ) : error ? null : (
        <ul className="mt-6 flex flex-col gap-3">
          {(messages as ContactMessageRow[]).map((m) => (
            <li key={m.id} className="rounded-lg border border-ligne bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-encre">
                    {m.subject}
                    <span className="ml-2 text-xs font-normal text-encre/50">
                      {new Date(m.created_at).toLocaleString("fr-FR")}
                    </span>
                  </p>
                  <p className="text-xs text-encre/60">
                    {m.name} — {m.email}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`}
                    className="rounded-md border border-ligne px-3 py-1 text-xs font-medium text-encre/70 hover:border-vert-actif hover:text-vert-actif"
                  >
                    Répondre
                  </a>
                  <MessageStatusButton messageId={m.id} status={m.status} />
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-encre/80">{m.message}</p>
            </li>
          ))}
        </ul>
      )}

      {!error && totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm">
          {page > 1 ? (
            <Link
              href={`/admin/messages?${new URLSearchParams({ ...(status !== "all" ? { status } : {}), page: String(page - 1) })}`}
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
              href={`/admin/messages?${new URLSearchParams({ ...(status !== "all" ? { status } : {}), page: String(page + 1) })}`}
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
