"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { NativeSelect, type NativeSelectOption } from "@/components/native-select";
import { sendAdminNotification, type SendNotificationFormState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 self-start rounded-md bg-vert-actif px-4 py-2 text-sm font-medium text-ivoire hover:bg-vert-sapin disabled:opacity-50"
    >
      {pending ? "Envoi..." : "Envoyer"}
    </button>
  );
}

/**
 * Formulaire d'envoi — créé le 01/10/2026 (demande d'Isaac : pouvoir prévenir
 * les boutiques d'un rappel, d'une info de parrainage, d'une nouvelle
 * fonctionnalité ou d'une fonctionnalité existante mais sous-utilisée, sans
 * passer par une migration SQL à chaque fois comme pour l'annonce
 * "localisation" de la migration 0052).
 *
 * Une seule `NativeSelect` pour le destinataire (toutes les boutiques actives
 * OU une boutique précise) plutôt que deux contrôles séparés (ex: radio +
 * select conditionnel) — plus simple, un seul choix à faire, cohérent avec le
 * "langage natif" déjà utilisé partout ailleurs dans le dashboard/back-office.
 *
 * Pas de confirmation supplémentaire avant l'envoi ("Es-tu sûr ?") : la cible
 * est toujours explicite dans la liste déroulante (nom de la boutique, ou le
 * nombre total pour "Toutes"), le risque d'envoi accidentel à la mauvaise
 * cible reste donc faible — même logique que les autres formulaires admin du
 * projet (pas de double confirmation sur la suspension d'une boutique, etc.).
 */
export function SendNotificationForm({
  shopOptions,
  activeShopsCount,
}: {
  shopOptions: NativeSelectOption[];
  activeShopsCount: number;
}) {
  const initialState: SendNotificationFormState = {};
  const [state, formAction] = useActionState(sendAdminNotification, initialState);

  const targetOptions: NativeSelectOption[] = [
    {
      value: "all",
      label: `Toutes les boutiques actives (${activeShopsCount})`,
    },
    ...shopOptions,
  ];

  return (
    <form
      action={formAction}
      key={state.success ?? "form"}
      className="mt-4 flex max-w-lg flex-col gap-4 rounded-lg border border-ligne bg-white p-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="target" className="text-sm font-medium text-encre">
          Destinataire
        </label>
        <NativeSelect
          id="target"
          name="target"
          label="Destinataire"
          defaultValue="all"
          options={targetOptions}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="title" className="text-sm font-medium text-encre">
          Titre
        </label>
        <input
          id="title"
          name="title"
          required
          maxLength={120}
          placeholder="Ex : Nouvelle fonctionnalité : codes promo"
          className="rounded-md border border-ligne px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="body" className="text-sm font-medium text-encre">
          Message <span className="text-encre/50">(optionnel)</span>
        </label>
        <textarea
          id="body"
          name="body"
          rows={4}
          maxLength={500}
          placeholder="Explique en quelques phrases — c'est ce que la boutique verra dans son espace Notifications et dans la notification reçue sur son téléphone/ordinateur."
          className="resize-none rounded-md border border-ligne px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="link" className="text-sm font-medium text-encre">
          Lien au clic <span className="text-encre/50">(optionnel)</span>
        </label>
        <input
          id="link"
          name="link"
          placeholder="Ex : /dashboard/parrainage"
          className="rounded-md border border-ligne px-3 py-2 text-sm"
        />
        <p className="text-xs text-encre/50">
          Un chemin interne KEVA (commence par /) — vers la page concernée par le message.
        </p>
      </div>

      {state.error && <p className="text-sm text-erreur">{state.error}</p>}
      {state.success && <p className="text-sm text-vert-sapin">{state.success}</p>}

      <SubmitButton />
    </form>
  );
}
