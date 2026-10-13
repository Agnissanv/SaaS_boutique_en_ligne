"use client";

import { useActionState } from "react";
import { updatePartnerTerms, type PartnerFormState } from "../actions";

/** Conditions fixées par le contrat : seul l'admin peut les changer. */
export function TermsForm({
  partnerId,
  label,
  businessCommission,
  proCommission,
  startsOn,
}: {
  partnerId: string;
  label: string;
  businessCommission: number;
  proCommission: number;
  startsOn: string;
}) {
  const initialState: PartnerFormState = {};
  const [state, formAction, pending] = useActionState(updatePartnerTerms.bind(null, partnerId), initialState);
  const inputClass = "rounded-md border border-ligne px-3 py-2 text-sm focus:ring-2 focus:ring-vert-actif";

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
      <div className="flex flex-col gap-1 sm:col-span-4">
        <label className="text-xs font-medium text-encre" htmlFor="terms-label">Nom (pour toi)</label>
        <input id="terms-label" name="label" required maxLength={80} defaultValue={label} className={inputClass} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-encre" htmlFor="terms-business">Par Business / mois (F)</label>
        <input id="terms-business" name="business_commission" type="number" min={0} step={50} required defaultValue={businessCommission} className={inputClass} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-encre" htmlFor="terms-pro">Par Pro / mois (F)</label>
        <input id="terms-pro" name="pro_commission" type="number" min={0} step={50} required defaultValue={proCommission} className={inputClass} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-encre" htmlFor="terms-start">Début</label>
        <input id="terms-start" name="starts_on" type="date" required defaultValue={startsOn} className={inputClass} />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-ligne bg-white px-4 py-2 text-sm font-medium text-encre hover:border-vert-actif disabled:opacity-50"
      >
        {pending ? "..." : "Enregistrer"}
      </button>
      {state.error ? <p className="text-sm text-erreur sm:col-span-4">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-succes sm:col-span-4">{state.success}</p> : null}
    </form>
  );
}
