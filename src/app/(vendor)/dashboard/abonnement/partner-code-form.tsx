"use client";

import { useActionState, useState } from "react";
import { applyPartnerCode, type PartnerCodeState } from "./actions";

/**
 * « Tu as un code partenaire ? » (13/10/2026, programme partenaire) — replié
 * derrière un lien pour ne pas encombrer la page de tout le monde ; affiché
 * seulement tant que la boutique n'est rattachée à personne et n'a jamais
 * payé (voir `getShopPartnerCodeState`).
 */
export function PartnerCodeForm() {
  const initialState: PartnerCodeState = {};
  const [state, formAction, pending] = useActionState(applyPartnerCode, initialState);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 text-sm text-vert-actif underline"
      >
        Tu as un code partenaire ?
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-4 max-w-md rounded-lg border border-ligne bg-white p-4">
      <label htmlFor="partner-code" className="text-sm font-medium text-encre">
        Code partenaire
      </label>
      <p className="mt-0.5 text-xs text-encre/60">
        À saisir avant ton premier paiement d&apos;abonnement.
      </p>
      <div className="mt-2 flex gap-2">
        <input
          id="partner-code"
          name="code"
          required
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={20}
          placeholder="Ex : DJANDJOU"
          className="min-w-0 flex-1 rounded-md border border-ligne px-3 py-2 font-mono text-sm uppercase tracking-wide focus:border-vert-actif focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-md bg-vert-actif px-4 py-2 text-sm font-medium text-ivoire hover:bg-vert-sapin disabled:opacity-50"
        >
          {pending ? "..." : "Appliquer"}
        </button>
      </div>
      {state.error ? <p className="mt-2 text-sm text-erreur">{state.error}</p> : null}
      {state.success ? <p className="mt-2 text-sm text-succes">{state.success}</p> : null}
    </form>
  );
}
