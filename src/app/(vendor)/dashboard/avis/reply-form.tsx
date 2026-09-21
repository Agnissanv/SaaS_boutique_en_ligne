"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { replyToReview, type ReplyFormState } from "./actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-cuivre-profond px-3 py-1.5 text-xs font-medium text-ivoire hover:bg-cuivre disabled:opacity-50"
    >
      {pending ? "Envoi..." : label}
    </button>
  );
}

/**
 * Réponse vendeur à un avis — tâche #78 du 21/09/2026 (voir migration 0028).
 * Un composant par avis (plutôt qu'un seul formulaire global) : chaque avis
 * a sa propre réponse, indépendante des autres, donc son propre état
 * "en édition ou non".
 *
 * Fermeture automatique du mode édition après un envoi réussi : plutôt qu'un
 * `useEffect` qui appellerait `setState` de façon synchrone (règle ESLint
 * `react-hooks/set-state-in-effect`, déjà rencontrée sur ce projet — voir
 * `marketplace-search.tsx`), le parent (page.tsx) donne à ce composant une
 * `key` dérivée de `seller_reply_at`, qui change à chaque écriture réussie
 * (voir migration 0028 : `now()` à chaque réponse, `null` à la suppression).
 * React démonte alors ce composant et le remonte avec un état local neuf
 * (`editing` retombe à `false`), sans jamais appeler `setState` en dehors
 * d'un gestionnaire d'événement.
 */
export function ReviewReplyForm({
  reviewId,
  initialReply,
}: {
  reviewId: string;
  initialReply: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const initialState: ReplyFormState = {};
  const [state, formAction] = useActionState(replyToReview, initialState);

  if (!editing) {
    return (
      <div className="mt-2">
        {initialReply ? (
          <div className="rounded-md bg-brume p-3">
            <p className="text-xs font-medium text-encre/70">Ta réponse</p>
            <p className="mt-1 text-sm text-encre/80">{initialReply}</p>
            <div className="mt-1.5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs text-encre/60 underline hover:text-vert-sapin"
              >
                Modifier
              </button>
              <form action={formAction}>
                <input type="hidden" name="reviewId" value={reviewId} />
                <button type="submit" className="text-xs text-erreur underline hover:opacity-80">
                  Supprimer ma réponse
                </button>
              </form>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-encre/60 underline hover:text-vert-sapin"
          >
            Répondre à cet avis
          </button>
        )}
        {state.error && <p className="mt-1 text-xs text-erreur">{state.error}</p>}
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="reviewId" value={reviewId} />
      <textarea
        name="reply"
        defaultValue={initialReply ?? ""}
        maxLength={500}
        rows={3}
        placeholder="Réponds publiquement à ce client..."
        className="rounded-md border border-ligne px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-vert-actif"
      />
      <div className="flex items-center gap-3">
        <SubmitButton label={initialReply ? "Mettre à jour" : "Publier la réponse"} />
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-xs text-encre/60 hover:text-encre"
        >
          Annuler
        </button>
      </div>
      {state.error && <p className="text-xs text-erreur">{state.error}</p>}
    </form>
  );
}
