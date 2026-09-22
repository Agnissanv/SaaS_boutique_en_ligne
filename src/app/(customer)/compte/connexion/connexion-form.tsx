"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GoogleAuthButton } from "@/components/google-auth-button";

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
    <div className="w-full mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 bg-brume">
      <Link href="/" className="mx-auto mb-6 flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- logo statique */}
        <img src="/keva-logo.jpg" alt="KEVA" className="h-10 w-10 rounded-md object-cover" />
        <span className="font-display text-xl font-bold tracking-wide text-vert-sapin">KEVA</span>
      </Link>
      <div className="rounded-xl border border-ligne bg-white p-6 shadow-sm">
        <h1 className="font-display text-xl font-semibold text-encre">Connexion</h1>

        {view === "password" && (
          <>
            <p className="mt-1 text-sm text-encre/70">
              {useMagicLink
                ? "Reçois un lien de connexion par email."
                : "Retrouve tes commandes passées sur la plateforme."}
            </p>

            {!useMagicLink ? (
              <form onSubmit={handlePasswordLogin} className="mt-6 flex flex-col gap-3">
                <label className="text-sm font-medium text-encre" htmlFor="email">
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
                  className="rounded-md border border-ligne px-3 py-2 text-sm focus:border-vert-actif focus:outline-none"
                />

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-encre" htmlFor="password">
                    Mot de passe
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs text-vert-actif underline"
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
                  className="rounded-md border border-ligne px-3 py-2 text-sm focus:border-vert-actif focus:outline-none"
                />

                {error && <p className="text-sm text-erreur">{error}</p>}

                <button
                  type="submit"
                  disabled={pending}
                  className="mt-2 rounded-md bg-vert-actif px-4 py-2 text-sm font-medium text-ivoire hover:bg-vert-sapin disabled:opacity-50"
                >
                  {pending ? "Connexion..." : "Se connecter"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUseMagicLink(true);
                    setError(null);
                  }}
                  className="text-center text-sm text-encre/60 underline"
                >
                  Se connecter par lien magique à la place
                </button>
              </form>
            ) : (
              <form onSubmit={handleMagicLink} className="mt-6 flex flex-col gap-3">
                <label className="text-sm font-medium text-encre" htmlFor="email-magic">
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
                  className="rounded-md border border-ligne px-3 py-2 text-sm focus:border-vert-actif focus:outline-none"
                />
                {error && <p className="text-sm text-erreur">{error}</p>}
                <button
                  type="submit"
                  disabled={pending}
                  className="mt-2 rounded-md bg-vert-actif px-4 py-2 text-sm font-medium text-ivoire hover:bg-vert-sapin disabled:opacity-50"
                >
                  {pending ? "Envoi..." : "Recevoir le lien"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUseMagicLink(false);
                    setError(null);
                  }}
                  className="text-center text-sm text-encre/60 underline"
                >
                  Se connecter avec un mot de passe à la place
                </button>
              </form>
            )}

            <div className="mt-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-ligne" />
              <span className="text-xs text-encre/40">ou</span>
              <div className="h-px flex-1 bg-ligne" />
            </div>
            <div className="mt-4">
              <GoogleAuthButton portal="customer" />
            </div>

            <p className="mt-4 text-center text-sm text-encre/60">
              Pas encore de compte ?{" "}
              <Link href="/compte/inscription" className="text-vert-actif underline">
                Créer un compte
              </Link>
            </p>
          </>
        )}

        {view === "magic-sent" && (
          <div className="mt-6 flex flex-col gap-3">
            <p className="text-sm text-encre/70">
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
              className="text-sm text-encre/60 underline"
            >
              Retour
            </button>
          </div>
        )}

        {view === "reset-sent" && (
          <div className="mt-6 flex flex-col gap-3">
            <p className="text-sm text-encre/70">
              Si un compte existe avec l&apos;adresse {email}, un email vient
              de lui être envoyé pour définir un mot de passe.
            </p>
            <button
              type="button"
              onClick={() => {
                setView("password");
                setError(null);
              }}
              className="text-sm text-encre/60 underline"
            >
              Retour
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
