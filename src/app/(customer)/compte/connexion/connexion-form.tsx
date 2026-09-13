"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Connexion client — portail séparé de /connexion (vendeur/admin), à la
 * demande d'Isaac du 15/09/2026 ("on peut proposer un compte aux clients,
 * mais pas obligatoire pour juste passer une commande"). Même mécanique
 * Supabase Auth (un seul auth.users pour toute la plateforme, cf.
 * migration 0014), mais audience et destination différentes : ici on
 * redirige toujours vers /compte (historique de commandes), jamais vers
 * /dashboard — pas de branchement par rôle nécessaire, ce portail n'est
 * utilisé que pour ça.
 *
 * Fonctionnalités calquées sur connexion-form.tsx (vendeur) : mot de passe +
 * lien magique + mot de passe oublié — le lien magique est même plus adapté
 * ici, beaucoup de clients WhatsApp/Instagram préférant ne rien retenir.
 */
export function ConnexionClientForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  type View = "password" | "magic-sent" | "reset-sent";
  const [view, setView] = useState<View>("password");
  const [useMagicLink, setUseMagicLink] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(() =>
    searchParams.get("erreur") === "lien_invalide"
      ? "Ce lien n'est plus valide (expiré, déjà utilisé, ou ouvert dans un autre navigateur que celui utilisé pour la demande). Réessaie ci-dessous."
      : null
  );

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    setPending(false);

    if (error || !data.user) {
      setError(
        "Email ou mot de passe incorrect — ou pas encore de mot de passe défini pour ce compte. Utilise « mot de passe oublié » ci-dessous, ou connecte-toi par lien magique."
      );
      return;
    }

    router.push("/compte");
    router.refresh();
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/compte`,
      },
    });

    setPending(false);

    if (error) {
      setError(
        error.message.includes("rate limit")
          ? "Trop de tentatives : réessaie dans quelques minutes."
          : "Impossible d'envoyer l'email — vérifie l'adresse, ou crée un compte si tu n'en as pas encore."
      );
      return;
    }

    setView("magic-sent");
  }

  async function handleForgotPassword() {
    if (!email) {
      setError("Renseigne d'abord ton adresse email ci-dessus.");
      return;
    }
    setError(null);
    setPending(true);

    // Réutilise la page partagée /connexion/nouveau-mot-de-passe (mécanique
    // Supabase identique quel que soit le rôle) : elle redirige maintenant
    // via roleHomePath(), donc un client atterrit bien sur /compte ensuite.
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/connexion/nouveau-mot-de-passe`,
    });

    setPending(false);
    setView("reset-sent");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Connexion</h1>

        {view === "password" && (
          <>
            <p className="mt-1 text-sm text-gray-600">
              {useMagicLink
                ? "Reçois un lien de connexion par email."
                : "Retrouve tes commandes passées sur la plateforme."}
            </p>

            {!useMagicLink ? (
              <form onSubmit={handlePasswordLogin} className="mt-6 flex flex-col gap-3">
                <label className="text-sm font-medium text-gray-700" htmlFor="email">
                  Adresse email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="toi@exemple.com"
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                />

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700" htmlFor="password">
                    Mot de passe
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs text-gray-500 underline"
                  >
                    Oublié / pas encore défini ?
                  </button>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                />

                {error && <p className="text-sm text-red-600">{error}</p>}

                <button
                  type="submit"
                  disabled={pending}
                  className="mt-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {pending ? "Connexion..." : "Se connecter"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUseMagicLink(true);
                    setError(null);
                  }}
                  className="text-center text-sm text-gray-500 underline"
                >
                  Se connecter par lien magique à la place
                </button>
              </form>
            ) : (
              <form onSubmit={handleMagicLink} className="mt-6 flex flex-col gap-3">
                <label className="text-sm font-medium text-gray-700" htmlFor="email-magic">
                  Adresse email
                </label>
                <input
                  id="email-magic"
                  name="email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="toi@exemple.com"
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={pending}
                  className="mt-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {pending ? "Envoi..." : "Recevoir le lien"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUseMagicLink(false);
                    setError(null);
                  }}
                  className="text-center text-sm text-gray-500 underline"
                >
                  Se connecter avec un mot de passe à la place
                </button>
              </form>
            )}

            <p className="mt-4 text-center text-sm text-gray-500">
              Pas encore de compte ?{" "}
              <Link href="/compte/inscription" className="underline">
                Créer un compte
              </Link>
            </p>
          </>
        )}

        {view === "magic-sent" && (
          <div className="mt-6 flex flex-col gap-3">
            <p className="text-sm text-gray-600">
              Email envoyé à {email}. Clique sur le lien reçu pour te
              connecter. Pense à vérifier tes spams s&apos;il n&apos;arrive
              pas après quelques minutes.
            </p>
            <button
              type="button"
              onClick={() => {
                setView("password");
                setError(null);
              }}
              className="text-sm text-gray-500 underline"
            >
              Retour
            </button>
          </div>
        )}

        {view === "reset-sent" && (
          <div className="mt-6 flex flex-col gap-3">
            <p className="text-sm text-gray-600">
              Si un compte existe avec l&apos;adresse {email}, un email vient
              de lui être envoyé pour définir un mot de passe.
            </p>
            <button
              type="button"
              onClick={() => {
                setView("password");
                setError(null);
              }}
              className="text-sm text-gray-500 underline"
            >
              Retour
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
