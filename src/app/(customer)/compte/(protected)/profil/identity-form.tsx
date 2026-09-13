"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateCustomerProfile, type CustomerProfileFormState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
    >
      {pending ? "Enregistrement..." : "Enregistrer"}
    </button>
  );
}

/**
 * Identité du compte client (nom + téléphone) — pas de photo de profil ici,
 * contrairement à la page équivalente côté vendeur (dashboard/profil) :
 * aucun endroit de l'app n'affiche un avatar client, ça n'apporterait rien.
 *
 * Le téléphone est le champ le plus important de ce formulaire : c'est lui
 * qui sert de correspondance pour claim_guest_orders() (migration 0014) —
 * un client qui corrige ici un numéro mal saisi ou en conflit à
 * l'inscription peut ensuite relancer "Rattacher mes anciennes commandes"
 * sur /compte pour retrouver son historique invité.
 */
export function IdentityForm({
  profile,
}: {
  profile: { displayName: string; phone: string };
}) {
  const initialState: CustomerProfileFormState = {};
  const [state, formAction] = useActionState(updateCustomerProfile, initialState);

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="displayName" className="text-sm font-medium text-gray-700">
          Nom complet
        </label>
        <input
          id="displayName"
          name="displayName"
          required
          minLength={2}
          maxLength={60}
          defaultValue={profile.displayName}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="phone" className="text-sm font-medium text-gray-700">
          Téléphone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          placeholder="+225 07 00 00 00 00"
          defaultValue={profile.phone}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <p className="text-xs text-gray-400">
          Sert à retrouver tes commandes passées sans compte, avec le même
          numéro (bouton « Rattacher mes anciennes commandes » sur la page
          précédente).
        </p>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600">Profil enregistré.</p>}

      <SubmitButton />
    </form>
  );
}
