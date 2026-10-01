import { createClient } from "@/lib/supabase/server";
import type { NativeSelectOption } from "@/components/native-select";
import { SendNotificationForm } from "./send-notification-form";

/**
 * Envoi de messages admin → boutiques (01/10/2026, demande d'Isaac) — jusqu'ici
 * la seule façon d'envoyer un "admin_message" était un insert SQL écrit à la
 * main dans une migration (voir 0052_shop_location_and_push.sql, l'annonce
 * "ajoute la localisation de ta boutique"). Cette page remplace ça par un
 * formulaire : rappel, info de parrainage, annonce de fonctionnalité, ou
 * piqûre de rappel sur une fonctionnalité existante mais sous-utilisée —
 * exactement les cas cités par Isaac.
 *
 * Reçu même hors de KEVA : chaque ligne insérée dans `notifications` déclenche
 * automatiquement l'envoi d'une notification push (trigger `pg_net`, migration
 * 0052) — rien de spécifique à coder ici, l'infrastructure du 01/10/2026 s'en
 * charge pour n'importe quel insert dans cette table, pas seulement les
 * commandes.
 *
 * **Historique des envois ajouté le 01/10/2026** (demande d'Isaac : avoir
 * l'historique "des deux côtés" — réception déjà là depuis le 21/09, il
 * manquait l'envoi). Lit `admin_notification_campaigns` (migration 0053, une
 * ligne par ENVOI groupé, pas par boutique destinataire) plutôt que
 * `notifications` directement — cette dernière garde une ligne par boutique,
 * la regrouper après coup pour afficher "envoyé à X boutiques" aurait demandé
 * une requête de regroupement fragile (titre+date approximatifs) au lieu
 * d'une donnée déjà exacte à l'écriture.
 *
 * Rétention de 90 jours (voir src/lib/message-retention.ts et le cron
 * /api/cron/purge-old-messages) : cette page ne montre donc que les envois
 * des ~3 derniers mois, le reste étant purgé pour ne pas saturer la base —
 * demande explicite d'Isaac, pas une limite technique de cette page.
 */
export default async function AdminNotificationsPage() {
  const supabase = await createClient();

  const [{ data: shops }, { data: campaigns }] = await Promise.all([
    supabase.from("shops").select("id, name").eq("status", "active").order("name", { ascending: true }),
    supabase
      .from("admin_notification_campaigns")
      .select("id, title, body, target_label, recipient_count, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const shopOptions: NativeSelectOption[] = (shops ?? []).map((shop) => ({
    value: shop.id,
    label: shop.name,
  }));

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-encre">Notifications</h1>
      <p className="mt-1 max-w-lg text-sm text-encre/70">
        Envoie un message à une boutique précise ou à toutes les boutiques actives — rappel,
        info de parrainage, nouvelle fonctionnalité, ou piqûre de rappel sur une fonctionnalité
        qu&apos;elle n&apos;a pas l&apos;habitude d&apos;utiliser. Le message arrive dans son
        espace &laquo;&nbsp;Notifications&nbsp;&raquo; et, si elle les a activées, en notification
        push sur son téléphone ou son ordinateur — même si elle n&apos;est pas sur KEVA au
        moment de l&apos;envoi.
      </p>

      <SendNotificationForm shopOptions={shopOptions} activeShopsCount={shopOptions.length} />

      <h2 className="mt-8 font-display text-sm font-semibold text-encre">
        Historique des envois
      </h2>
      <p className="mt-1 text-xs text-encre/50">
        Les envois de plus de 90 jours sont automatiquement supprimés.
      </p>

      {(campaigns ?? []).length === 0 ? (
        <p className="mt-4 rounded-lg border border-ligne bg-white p-4 text-sm text-encre/60">
          Aucun message envoyé pour l&apos;instant.
        </p>
      ) : (
        <ul className="mt-4 overflow-hidden rounded-lg border border-ligne bg-white">
          {(campaigns ?? []).map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-1 border-b border-ligne px-4 py-3 last:border-0"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-encre">{c.title}</p>
                <p className="text-xs text-encre/40">
                  {new Date(c.created_at).toLocaleString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              {c.body && <p className="text-sm text-encre/60">{c.body}</p>}
              <p className="text-xs text-encre/50">
                {c.target_label} — {c.recipient_count} boutique
                {c.recipient_count > 1 ? "s" : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
