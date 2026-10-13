"use client";

import { useActionState } from "react";
import { attachShopToPartner, type PartnerFormState } from "../actions";

/** Rattachement manuel d'une boutique oubliée (lien ou identifiant de la boutique). */
export function AttachShopForm({ partnerId }: { partnerId: string }) {
  const initialState: PartnerFormState = {};
  const [state, formAction, pending] = useActionState(attachShopToPartner.bind(null, partnerId), initialState);
  return (
    <form action={formAction} className="mt-3">
      <div className="flex gap-2">
        <input
          name="shop"
          required
          placeholder="shopkeva.com/nom-de-la-boutique"
          aria-label="Lien ou identifiant de la boutique"
          className="min-w-0 flex-1 rounded-md border border-ligne px-3 py-2 text-sm focus:ring-2 focus:ring-vert-actif"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-md border border-ligne bg-white px-3 py-2 text-sm font-medium text-encre hover:border-vert-actif disabled:opacity-50"
        >
          {pending ? "..." : "Rattacher"}
        </button>
      </div>
      {state.error ? <p className="mt-2 text-sm text-erreur">{state.error}</p> : null}
      {state.success ? <p className="mt-2 text-sm text-succes">{state.success}</p> : null}
    </form>
  );
}
