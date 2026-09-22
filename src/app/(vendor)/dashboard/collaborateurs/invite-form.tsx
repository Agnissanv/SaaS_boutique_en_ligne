"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { inviteCollaborator, type InviteFormState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 rounded-md bg-vert-actif px-4 py-2 text-sm font-medium text-ivoire hover:bg-vert-sapin disabled:opacity-50"
    >
      {pending ? "Envoi..." : "Inviter"}
    </button>
  );
}

/**
 * Formulaire d'invitation par email — pas de recherche de compte existant :
 * l'invitation est enregistrée sur l'adresse email, et matchée au moment où
 * la personne accepte depuis /dashboard/boutique (voir
 * accept_shop_collaboration, migration 0024).
 */
export function InviteForm() {
  const initialState: InviteFormState = {};
  const [state, formAction] = useActionState(inviteCollaborator, initialState);

  return (
    <form
      action={formAction}
      className="mt-4 flex max-w-md flex-col gap-3 rounded-lg border border-ligne bg-white p-4 sm:flex-row sm:items-end"
    >
      <div className="flex flex-1 flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-encre">
          Email de la personne à inviter
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="collegue@exemple.com"
          className="rounded-md border border-ligne px-3 py-2 text-sm focus:ring-2 focus:ring-vert-actif"
        />
      </div>
      <SubmitButton />
      {state.error && <p className="text-sm text-erreur sm:basis-full">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-succes sm:basis-full">Invitation envoyée.</p>
      )}
    </form>
  );
}
