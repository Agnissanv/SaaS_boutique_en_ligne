"use client";

import { useActionState } from "react";
import { createPartnerInvitation, type PartnerFormState } from "./actions";

/**
 * Nouvelle invitation partenaire : Isaac fixe ce qui relève du contrat
 * (montants, date de début) ; la partenaire choisira elle-même son nom
 * affiché, son code et son numéro de paiement en ouvrant le lien.
 */
export function CreatePartnerForm() {
  const initialState: PartnerFormState = {};
  const [state, formAction, pending] = useActionState(createPartnerInvitation, initialState);
  const today = new Date().toISOString().slice(0, 10);
  const inputClass = "rounded-md border border-ligne px-3 py-2 text-sm focus:ring-2 focus:ring-vert-actif";

  return (
    <div className="rounded-lg border border-ligne bg-white p-4">
      <h2 className="font-display text-sm font-semibold text-encre">Nouvelle invitation</h2>
      <p className="mt-1 text-xs text-encre/70">
        Tu obtiens un lien à envoyer sur WhatsApp, valable 7 jours et utilisable une seule fois.
      </p>
      <form action={formAction} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
        <div className="flex flex-col gap-1 sm:col-span-4">
          <label htmlFor="partner-label" className="text-xs font-medium text-encre">
            Nom (pour toi)
          </label>
          <input id="partner-label" name="label" required maxLength={80} placeholder="Ex : Awa Koné" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="partner-business" className="text-xs font-medium text-encre">
            Par Business / mois (F)
          </label>
          <input id="partner-business" name="business_commission" type="number" min={0} step={50} required defaultValue={1000} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="partner-pro" className="text-xs font-medium text-encre">
            Par Pro / mois (F)
          </label>
          <input id="partner-pro" name="pro_commission" type="number" min={0} step={50} required defaultValue={2000} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="partner-start" className="text-xs font-medium text-encre">
            Début du partenariat
          </label>
          <input id="partner-start" name="starts_on" type="date" required defaultValue={today} className={inputClass} />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-vert-actif px-4 py-2 text-sm font-medium text-ivoire transition hover:bg-vert-sapin disabled:opacity-50"
        >
          {pending ? "Création..." : "Créer l'invitation"}
        </button>
      </form>
      {state.error ? <p className="mt-2 text-sm text-erreur">{state.error}</p> : null}
    </div>
  );
}
