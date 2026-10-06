"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PASSWORD_MIN_LENGTH as MIN_LENGTH, resolveHomePath } from "@/lib/auth-constants";

// Recolorée en charte KEVA le 15/09/2026 (côté client) — pure recolor, même
// traitement que connexion-form.tsx (mêmes tokens de champ/bouton).
export function NouveauMotDePasseForm() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

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

    if (updateError) {
      setPending(false);
      setError("Impossible d'enregistrer ce mot de passe. Réessaie.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: profile } = user
      ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
      : { data: null };

    router.push(user ? await resolveHomePath(supabase, user.id, profile?.role) : "/connexion");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
      <label className="text-sm font-medium text-encre" htmlFor="password">
        Nouveau mot de passe
      </label>
      <input
        id="password"
        name="new-password"
        type="password"
        required
        autoFocus
        autoComplete="new-password"
        minLength={MIN_LENGTH}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        className="rounded-md border border-ligne px-3 py-2 text-sm focus:border-vert-actif focus:outline-none"
      />

      <label className="text-sm font-medium text-encre" htmlFor="confirm">
        Confirme le mot de passe
      </label>
      <input
        id="confirm"
        name="confirm-password"
        type="password"
        required
        autoComplete="new-password"
        minLength={MIN_LENGTH}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="••••••••"
        className="rounded-md border border-ligne px-3 py-2 text-sm focus:border-vert-actif focus:outline-none"
      />

      {error && <p className="text-sm text-erreur">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-vert-actif px-4 py-2 text-sm font-medium text-ivoire hover:bg-vert-sapin disabled:opacity-50"
      >
        {pending ? "Enregistrement..." : "Enregistrer et continuer"}
      </button>
    </form>
  );
}
