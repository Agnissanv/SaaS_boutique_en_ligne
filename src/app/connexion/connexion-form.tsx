"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resolveHomePath } from "@/lib/auth-constants";
import { GoogleAuthButton } from "@/components/google-auth-button";

/**
 * Connexion vendeur/admin — deux méthodes (13/09/2026, suite à la remarque
 * d'Isaac : "ceux qui ont déjà un compte ne peuvent pas se connecter, ils
 * doivent générer un nouveau lien").
 *
 * 1) Mot de passe (par défaut) : email + mot de passe → connexion instantanée.
 * 2) Lien magique (secours) : toujours disponible pour qui n'a pas encore
 *    défini de mot de passe, ou qui préfère ne pas en retenir un.
 *
 * "Mot de passe oublié" et "pas encore défini" utilisent le même mécanisme
 * (`resetPasswordForEmail`) : un compte créé jusqu'ici uniquement par lien
 * magique n'a pas de mot de passe dans `auth.users`, donc pour lui la
 * première définition passe par ce même flux — pas de distinction utile à
 * faire côté UI, et ça évite de révéler si un compte a déjà un mot de passe.
 *
 * Le lien de réinitialisation réutilise /auth/callback (voir ce fichier :
 * il gère déjà `?next=`) avec `next=/connexion/nouveau-mot-de-passe`.
 *
 * Mise à jour du 13/09/2026 (ajout de /inscription) : le lien magique ne
 * crée plus de compte implicitement (`shouldCreateUser: false`). Avant, il
 * suffisait de cliquer sur "recevoir le lien" avec n'importe quel email pour
 * créer un compte sans jamais renseigner de nom — le profil héritait par
 * défaut de la partie locale de l'email. Désormais, la création passe
 * uniquement par /inscription (nom + mot de passe collectés dès le départ),
 * et le lien magique redevient une simple méthode de connexion alternative
 * pour un compte déjà existant.
 */
export function ConnexionForm() {
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

    if (error || !data.user) {
      setPending(false);
      setError(
        "Email ou mot de passe incorrect — ou pas encore de mot de passe défini pour ce compte. Utilise « mot de passe oublié » ci-dessous, ou connecte-toi par lien magique."
      );
      return;
    }

    // Redirection selon le rôle ET la réalité de ce que le compte possède
    // (voir resolveHomePath) — pas seulement l'étiquette de rôle figée à
    // l'inscription, cf. demande d'Isaac du 13/09/2026 ("un portail... qui
    // reconnaît le rôle de chacun") et le bug signalé le 21/09/2026.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();

    router.push(await resolveHomePath(supabase, data.user.id, profile?.role));
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
        emailRedirectTo: `${window.location.origin}/auth/callback`,
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

    // On ignore volontairement le résultat détaillé (existence du compte) :
    // même message dans tous les cas, pour ne pas révéler quels emails sont
    // inscrits sur la plateforme.
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
                : "Connecte-toi avec ton email et ton mot de passe."}
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
              <GoogleAuthButton />
            </div>

            <p className="mt-4 text-center text-sm text-encre/60">
              Pas encore de compte ?{" "}
              <Link href="/inscription" className="text-vert-actif underline">
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
