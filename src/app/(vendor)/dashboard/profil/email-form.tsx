"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Changement d'email de connexion — passe par `supabase.auth.updateUser`
 * côté client (même approche que le changement de mot de passe, voir
 * nouveau-mot-de-passe-form.tsx), PAS par une Server Action : c'est une
 * opération d'authentification qui doit utiliser la session du navigateur.
 *
 * Supabase envoie un email de confirmation à la nouvelle adresse (comportement
 * par défaut du projet) avant que le changement ne soit effectif — l'email de
 * connexion actuel ne change donc pas tant que le vendeur n'a pas cliqué le
 * lien reçu. On l'indique explicitement pour éviter toute confusion.
 */
export function EmailForm({ currentEmail }: { currentEmail: string }) {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!email || email === currentEmail) {
      setError("Renseigne une nouvelle adresse email, différente de l'actuelle.");
      return;
    }

    setPending(true);
    const { error: updateError } = await supabase.auth.updateUser({ email });
    setPending(false);

    if (updateError) {
      setError("Impossible de changer l'email. Réessaie.");
      return;
    }

    setSuccess(true);
    setEmail("");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3">
      <p className="text-sm text-gray-600">
        Email actuel : <span className="font-medium text-gray-900">{currentEmail}</span>
      </p>

      <div className="flex flex-col gap-1">
        <label htmlFor="newEmail" className="text-sm font-medium text-gray-700">
          Nouvelle adresse email
        </label>
        <input
          id="newEmail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nouvelle-adresse@exemple.com"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <p className="text-xs text-gray-400">
          Un email de confirmation sera envoyé à cette adresse. Le changement
          ne sera effectif qu&apos;après avoir cliqué sur le lien reçu.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && (
        <p className="text-sm text-green-600">
          Email de confirmation envoyé. Vérifie ta boîte de réception.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 w-fit rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Envoi..." : "Changer l'email"}
      </button>
    </form>
  );
}
