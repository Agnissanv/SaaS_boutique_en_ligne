"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  updateNotificationEmail,
  type NotificationEmailState,
} from "../../boutique/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 w-fit rounded-md bg-vert-actif px-4 py-2 text-sm font-medium text-ivoire hover:bg-vert-sapin disabled:opacity-50"
    >
      {pending ? "Enregistrement..." : "Enregistrer"}
    </button>
  );
}

/**
 * Interrupteur "Notifications par email" — ajouté le 30/09/2026 (refonte de
 * l'espace Paramètres). S'appuie sur `shops.notification_email`, qui existait
 * déjà (migration 0013) mais n'était jusqu'ici qu'un simple champ texte sur
 * "Ma boutique" ("vide = désactivé, rempli = activé") : ici, un vrai
 * interrupteur pilote la même colonne — activé sans email déjà enregistré,
 * le champ se pré-remplit avec l'email de connexion (le cas le plus courant),
 * modifiable avant d'enregistrer ; désactivé, l'email est effacé en base
 * (`updateNotificationEmail`, voir boutique/actions.ts) pour arrêter
 * réellement l'envoi, pas juste masquer le champ côté UI.
 */
export function NotificationEmailForm({
  currentEmail,
  accountEmail,
}: {
  currentEmail: string | null;
  accountEmail: string;
}) {
  const initialState: NotificationEmailState = {};
  const [state, formAction] = useActionState(updateNotificationEmail, initialState);
  const [enabled, setEnabled] = useState(Boolean(currentEmail));

  return (
    <form action={formAction} className="mt-3 flex max-w-md flex-col gap-3">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-ligne text-vert-actif focus:ring-vert-actif"
        />
        <span className="text-sm">
          <span className="font-medium text-encre">Recevoir des notifications par email</span>
          <span className="mt-0.5 block text-xs text-encre/50">
            Nouvelle commande, et stock bas sur le plan Pro.
          </span>
        </span>
      </label>

      {enabled && (
        <div className="flex flex-col gap-1 pl-7">
          <label htmlFor="notificationEmail" className="text-sm font-medium text-encre">
            Adresse email
          </label>
          <input
            id="notificationEmail"
            name="notificationEmail"
            type="email"
            defaultValue={currentEmail ?? accountEmail}
            placeholder={accountEmail}
            className="rounded-md border border-ligne px-3 py-2 text-sm focus:ring-2 focus:ring-vert-actif"
          />
          <p className="text-xs text-encre/50">Peut être différente de ton email de connexion.</p>
        </div>
      )}

      {state.error && <p className="text-sm text-erreur">{state.error}</p>}
      {state.success && <p className="text-sm text-succes">Préférences enregistrées.</p>}

      <SubmitButton />
    </form>
  );
}
