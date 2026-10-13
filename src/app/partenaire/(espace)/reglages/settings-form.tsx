"use client";

import { useActionState } from "react";
import { updatePartnerSettings, type PartnerSettingsState } from "./actions";
import { PAYOUT_METHOD_LABELS } from "@/lib/partners";

export function PartnerSettingsForm({
  displayName,
  code,
  payoutMethod,
  payoutPhone,
  codeLocked,
}: {
  displayName: string;
  code: string;
  payoutMethod: string | null;
  payoutPhone: string | null;
  codeLocked: boolean;
}) {
  const initialState: PartnerSettingsState = {};
  const [state, formAction, pending] = useActionState(updatePartnerSettings, initialState);
  const inputClass =
    "rounded-md border border-ligne px-3 py-2 text-sm focus:border-vert-actif focus:outline-none";

  return (
    <form action={formAction} className="mt-5 flex max-w-md flex-col gap-3 rounded-lg border border-ligne bg-white p-4">
      <label className="text-sm font-medium text-encre" htmlFor="display_name">
        Nom affiché
      </label>
      <input id="display_name" name="display_name" required maxLength={60} defaultValue={displayName} className={inputClass} />

      <label className="text-sm font-medium text-encre" htmlFor="code">
        Code partenaire
      </label>
      <input
        id="code"
        name="code"
        required
        maxLength={20}
        autoComplete="off"
        autoCapitalize="characters"
        defaultValue={code}
        readOnly={codeLocked}
        className={`${inputClass} font-mono uppercase tracking-wide ${codeLocked ? "bg-brume text-encre/70" : ""}`}
      />
      <p className="-mt-1 text-xs text-encre/70">
        {codeLocked
          ? "Ton partenariat est terminé : le code ne peut plus changer."
          : "Si tu changes de code, l'ancien continue de marcher : tes anciennes vidéos te rapportent toujours."}
      </p>

      <label className="text-sm font-medium text-encre" htmlFor="payout_method">
        Où recevoir tes commissions
      </label>
      <div className="flex gap-2">
        <select
          id="payout_method"
          name="payout_method"
          required
          defaultValue={payoutMethod ?? "wave"}
          className={`${inputClass} shrink-0 bg-white`}
        >
          {Object.entries(PAYOUT_METHOD_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          name="payout_phone"
          type="tel"
          required
          inputMode="tel"
          defaultValue={payoutPhone ?? ""}
          aria-label="Numéro de paiement"
          className={`${inputClass} min-w-0 flex-1`}
        />
      </div>

      {state.error ? <p className="text-sm text-erreur">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-succes">{state.success}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 self-start rounded-md bg-vert-actif px-4 py-2 text-sm font-medium text-ivoire hover:bg-vert-sapin disabled:opacity-50"
      >
        {pending ? "Enregistrement..." : "Enregistrer"}
      </button>
    </form>
  );
}
