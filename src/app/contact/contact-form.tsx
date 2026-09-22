"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { sendContactMessage, type ContactFormState } from "./actions";

const SUBJECTS = [
  "Question générale",
  "Problème avec une commande",
  "Avis sur KEVA",
  "Autre",
];

const initialState: ContactFormState = {};

// Même pattern que profile-form.tsx : `useFormStatus` dans un sous-composant
// (doit être un enfant du <form>, pas le composant qui le rend) plutôt que le
// 3e élément de `useActionState`, pour rester cohérent avec le reste du projet.
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 w-fit rounded-md bg-cuivre-profond px-4 py-2 text-sm font-medium text-ivoire hover:bg-cuivre disabled:opacity-50"
    >
      {pending ? "Envoi..." : "Envoyer"}
    </button>
  );
}

export function ContactForm({
  defaultName,
  defaultEmail,
  defaultSubject,
}: {
  defaultName: string;
  defaultEmail: string;
  defaultSubject: string;
}) {
  const [state, formAction] = useActionState(sendContactMessage, initialState);

  if (state.success) {
    return (
      <div className="mt-6 rounded-xl border border-ligne bg-white p-6 text-sm">
        <p className="font-medium text-succes">Message envoyé !</p>
        <p className="mt-1 text-encre/70">
          On te répond directement à l&apos;adresse que tu as indiquée, dès que possible.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4 rounded-xl border border-ligne bg-white p-6">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium text-encre">
          Nom
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={defaultName}
          className="rounded-md border border-ligne px-3 py-2 text-sm focus:ring-2 focus:ring-vert-actif"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-encre">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          defaultValue={defaultEmail}
          placeholder="toi@exemple.com"
          className="rounded-md border border-ligne px-3 py-2 text-sm focus:ring-2 focus:ring-vert-actif"
        />
        <p className="text-xs text-encre/50">On répond directement à cette adresse.</p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="subject" className="text-sm font-medium text-encre">
          Sujet
        </label>
        <select
          id="subject"
          name="subject"
          defaultValue={defaultSubject}
          className="rounded-md border border-ligne bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-vert-actif"
        >
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="message" className="text-sm font-medium text-encre">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          minLength={10}
          maxLength={4000}
          rows={6}
          className="resize-none rounded-md border border-ligne px-3 py-2 text-sm focus:ring-2 focus:ring-vert-actif"
        />
      </div>

      {state.error && <p className="text-sm text-erreur">{state.error}</p>}

      <SubmitButton />
    </form>
  );
}
