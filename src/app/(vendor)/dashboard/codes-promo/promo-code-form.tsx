"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createPromoCode, type PromoCodeFormState } from "./actions";
import { NativeSelect } from "@/components/native-select";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 rounded-md bg-cuivre-profond px-4 py-2 text-sm font-medium text-ivoire hover:bg-cuivre disabled:opacity-50"
    >
      {pending ? "Création..." : "Créer le code"}
    </button>
  );
}

/**
 * Formulaire de création — pas de modification une fois créé (supprimer et
 * recréer plutôt qu'éditer, même simplicité que "supprimer puis recréer"
 * pour les variantes/photos produit ailleurs dans le projet). `discountType`
 * en `NativeSelect` pour rester cohérent avec le reste du dashboard vendeur
 * (chantier "langage natif" du 15/09/2026 — jamais un `<select>` natif nu).
 */
export function PromoCodeForm() {
  const initialState: PromoCodeFormState = {};
  const [state, formAction] = useActionState(createPromoCode, initialState);

  return (
    <form
      action={formAction}
      className="mt-4 flex max-w-md flex-col gap-4 rounded-lg border border-ligne bg-white p-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="code" className="text-sm font-medium text-encre">
          Code
        </label>
        <input
          id="code"
          name="code"
          required
          maxLength={30}
          placeholder="Ex : BIENVENUE10"
          className="rounded-md border border-ligne px-3 py-2 text-sm uppercase"
        />
      </div>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="discountType" className="text-sm font-medium text-encre">
            Type
          </label>
          <NativeSelect
            id="discountType"
            name="discountType"
            label="Type de réduction"
            defaultValue="percentage"
            options={[
              { value: "percentage", label: "Pourcentage (%)" },
              { value: "fixed", label: "Montant fixe (FCFA)" },
            ]}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="discountValue" className="text-sm font-medium text-encre">
            Valeur
          </label>
          <input
            id="discountValue"
            name="discountValue"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            required
            placeholder="10"
            className="rounded-md border border-ligne px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="maxUses" className="text-sm font-medium text-encre">
            Utilisations max <span className="text-encre/50">(optionnel)</span>
          </label>
          <input
            id="maxUses"
            name="maxUses"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Illimité"
            className="rounded-md border border-ligne px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="expiresAt" className="text-sm font-medium text-encre">
            Expire le <span className="text-encre/50">(optionnel)</span>
          </label>
          <input
            id="expiresAt"
            name="expiresAt"
            type="date"
            className="rounded-md border border-ligne px-3 py-2 text-sm"
          />
        </div>
      </div>

      {state.error && <p className="text-sm text-erreur">{state.error}</p>}

      <SubmitButton />
    </form>
  );
}
