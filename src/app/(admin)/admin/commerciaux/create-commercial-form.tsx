"use client";

import { useActionState } from "react";
import { createCommercial, type CreateCommercialState } from "./actions";

/**
 * Formulaire de création d'un compte commercial (23/09/2026) — même
 * convention `useActionState` que shop-form.tsx/product-form.tsx.
 *
 * Le mot de passe généré n'apparaît qu'une fois, dans `state.success` juste
 * après la création : ni la base ni cette page ne le montrent plus jamais
 * ensuite (voir actions.ts) — encadré ici pour qu'Isaac ne le manque pas et
 * pense à le noter/relayer avant de fermer la page.
 */
export function CreateCommercialForm() {
  const initialState: CreateCommercialState = {};
  const [state, formAction] = useActionState(createCommercial, initialState);

  return (
    <div className="rounded-lg border border-ligne bg-white p-4">
      <h2 className="font-display text-sm font-semibold text-encre">Ajouter un commercial</h2>
      <p className="mt-1 text-xs text-encre/60">
        Crée un compte de connexion dédié — le commercial verra son propre
        lien de recrutement et ses commissions sur son espace.
      </p>

      <form action={formAction} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor="commercial-name" className="text-xs font-medium text-encre">
            Nom complet
          </label>
          <input
            id="commercial-name"
            name="name"
            required
            minLength={2}
            maxLength={80}
            placeholder="Ex : Koffi N'Guessan"
            className="rounded-md border border-ligne px-3 py-2 text-sm focus:ring-2 focus:ring-vert-actif"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor="commercial-email" className="text-xs font-medium text-encre">
            Email
          </label>
          <input
            id="commercial-email"
            name="email"
            type="email"
            required
            placeholder="commercial@exemple.com"
            className="rounded-md border border-ligne px-3 py-2 text-sm focus:ring-2 focus:ring-vert-actif"
          />
        </div>
        <button
          type="submit"
          className="shrink-0 rounded-md bg-vert-actif px-4 py-2 text-sm font-medium text-ivoire transition hover:bg-vert-sapin"
        >
          Créer le compte
        </button>
      </form>

      {state.error && <p className="mt-3 text-sm text-erreur">{state.error}</p>}

      {state.success && (
        <div className="mt-4 rounded-md border border-vert-actif/30 bg-vert-actif/5 p-3 text-sm">
          <p className="font-medium text-encre">
            Compte créé pour {state.success.name} — note ces identifiants maintenant,
            le mot de passe ne sera plus jamais affiché :
          </p>
          <dl className="mt-2 flex flex-col gap-1 font-mono text-xs text-encre/80">
            <div>
              <dt className="inline text-encre/50">Email : </dt>
              <dd className="inline">{state.success.email}</dd>
            </div>
            <div>
              <dt className="inline text-encre/50">Mot de passe : </dt>
              <dd className="inline">{state.success.password}</dd>
            </div>
            <div>
              <dt className="inline text-encre/50">Code de suivi : </dt>
              <dd className="inline">{state.success.code}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
