"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PASSWORD_MIN_LENGTH as MIN_LENGTH } from "@/lib/auth-constants";

/**
 * Changement de mot de passe depuis un profil déjà connecté — extrait de
 * (vendor)/dashboard/profil/password-form.tsx le 15/09/2026 pour être
 * partagé avec le profil client (§ comptes client optionnels) : composant
 * entièrement générique, aucune raison d'en garder une deuxième copie.
 *
 * Même appel `supabase.auth.updateUser({ password })` que le flux "mot de
 * passe oublié" (connexion/nouveau-mot-de-passe-form.tsx), mais sans passer
 * par un lien de réinitialisation par email puisque la session est déjà
 * valide ici.
 */
export function PasswordForm() {
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (password.length < MIN_LENGTH) {
      setError(`Le mot de passe doit faire au moins ${MIN_LENGTH} caractères.`);
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setPending(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (updateError) {
      setError("Impossible d'enregistrer ce mot de passe. Réessaie.");
      return;
    }

    setSuccess(true);
    setPassword("");
    setConfirm("");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="newPassword" className="text-sm font-medium text-encre">
          Nouveau mot de passe
        </label>
        <input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={MIN_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="rounded-md border border-ligne px-3 py-2 text-sm focus:ring-2 focus:ring-vert-actif"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="confirmPassword" className="text-sm font-medium text-encre">
          Confirme le mot de passe
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={MIN_LENGTH}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
          className="rounded-md border border-ligne px-3 py-2 text-sm focus:ring-2 focus:ring-vert-actif"
        />
      </div>

      {error && <p className="text-sm text-erreur">{error}</p>}
      {success && <p className="text-sm text-succes">Mot de passe mis à jour.</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 w-fit rounded-md bg-cuivre-profond px-4 py-2 text-sm font-medium text-ivoire hover:bg-cuivre disabled:opacity-50"
      >
        {pending ? "Enregistrement..." : "Changer le mot de passe"}
      </button>
    </form>
  );
}
