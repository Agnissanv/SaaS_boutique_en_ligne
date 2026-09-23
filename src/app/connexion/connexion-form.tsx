"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resolveHomePath, PASSWORD_MIN_LENGTH } from "@/lib/auth-constants";
import { GoogleAuthButton } from "@/components/google-auth-button";

/**
 * Connexion vendeur/admin — deux méthodes (13/09/2026, suite à la remarque
 * d'Isaac : "ceux qui ont déjà un compte ne peuvent pas se connecter, ils
 * doivent générer un nouveau lien").
 *
 * 1) Mot de passe (par défaut) : email + mot de passe → connexion instantanée.
 * 2) Code par email (secours) : toujours disponible pour qui n'a pas encore
 *    défini de mot de passe, ou qui préfère ne pas en retenir un.
 *
 * **Passage du lien au code, le 23/09/2026** — remontée d'Isaac : plusieurs
 * vendeurs ont trouvé la création de compte, et surtout la réinitialisation
 * de mot de passe, "compliquées". Cause probable : tout reposait sur un LIEN
 * cliquable par email (flux PKCE), avec ses pièges déjà rencontrés en
 * pratique (lien expiré, déjà utilisé, ou ouvert dans un autre
 * navigateur/appli que celui ayant fait la demande — limite connue du PKCE,
 * le `code_verifier` restant dans le navigateur d'origine). Un code à 6
 * chiffres tapé à la main n'a aucune de ces limites : il marche depuis
 * n'importe quel appareil, y compris en le lisant dans l'appli mail du
 * téléphone pour le taper sur l'ordinateur.
 *
 * Décisions tranchées avec Isaac (AskUserQuestion) : code PAR EMAIL (pas
 * SMS — aucun coût récurrent, réutilise le SMTP Brevo déjà configuré, voir
 * decisions-techniques.md — l'intégration Orange SMS déjà présente dans le
 * repo, `src/lib/sms/orange.ts`, reste disponible pour plus tard si le
 * besoin change), appliqué aux DEUX flux à la fois (connexion par code ET
 * réinitialisation de mot de passe), pas seulement la réinitialisation qui
 * a motivé la demande.
 *
 * Mécanique Supabase (`verifyOtp`, plus `exchangeCodeForSession`) :
 * - Connexion par code : `signInWithOtp({ email })` envoie l'email, puis
 *   `verifyOtp({ email, token, type: "email" })` établit la session
 *   directement — ce flux ne passe plus du tout par /auth/callback.
 * - Mot de passe oublié : `resetPasswordForEmail(email)` envoie l'email,
 *   puis `verifyOtp({ email, token, type: "recovery" })` établit une session
 *   de récupération, suivie de `updateUser({ password })` — tout se passe
 *   sur CET écran, sans navigation. La page dédiée qui servait de point
 *   d'arrivée à l'ancien lien (`/connexion/nouveau-mot-de-passe`) est donc
 *   supprimée : plus rien n'y renvoie.
 *
 * ⚠️ Ne fonctionne que si les templates email "Magic Link" et "Reset
 * Password" du dashboard Supabase (Authentication > Email Templates)
 * affichent `{{ .Token }}` — par défaut Supabase n'y met qu'un lien cliquable
 * (`{{ .ConfirmationURL }}`), jamais le code brut. Voir decisions-techniques.md
 * pour les deux templates exacts à coller (remplacent le lien, ne le gardent
 * pas en plus — Isaac ne veut plus que ce lien soit envoyé du tout).
 *
 * "Oublié / pas encore défini ?" reste un seul et même mécanisme
 * (`resetPasswordForEmail`) pour "mot de passe oublié" ET la première
 * définition d'un mot de passe par un compte créé jusqu'ici uniquement par
 * code de connexion (ces comptes n'ont simplement pas de mot de passe dans
 * `auth.users`) — pas de distinction utile à faire côté UI, et ça évite de
 * révéler si un compte a déjà un mot de passe ou pas.
 */
export function ConnexionForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  type View = "password" | "email-code" | "reset-code";
  const [view, setView] = useState<View>("password");
  const [useEmailCode, setUseEmailCode] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(() =>
    searchParams.get("erreur") === "lien_invalide"
      ? "La connexion avec Google a échoué (lien expiré ou déjà utilisé). Réessaie ci-dessous."
      : null
  );

  async function redirectForUser(userId: string) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    router.push(await resolveHomePath(supabase, userId, profile?.role));
    router.refresh();
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      setPending(false);
      setError(
        "Email ou mot de passe incorrect — ou pas encore de mot de passe défini pour ce compte. Utilise « mot de passe oublié » ci-dessous, ou connecte-toi par code reçu par email."
      );
      return;
    }

    await redirectForUser(data.user.id);
  }

  async function handleSendLoginCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });

    setPending(false);

    if (error) {
      setError(
        error.message.includes("rate limit")
          ? "Trop de tentatives : réessaie dans quelques minutes."
          : "Impossible d'envoyer le code — vérifie l'adresse, ou crée un compte si tu n'en as pas encore."
      );
      return;
    }

    setCode("");
    setView("email-code");
  }

  async function handleVerifyLoginCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });

    if (error || !data.user) {
      setPending(false);
      setError("Code invalide ou expiré. Vérifie le code reçu par email, ou demande-en un nouveau.");
      return;
    }

    await redirectForUser(data.user.id);
  }

  async function handleSendResetCode() {
    if (!email) {
      setError("Renseigne d'abord ton adresse email ci-dessus.");
      return;
    }
    setError(null);
    setPending(true);

    // On ignore volontairement le résultat détaillé (existence du compte) :
    // même message dans tous les cas, pour ne pas révéler quels emails sont
    // inscrits sur la plateforme.
    await supabase.auth.resetPasswordForEmail(email);

    setPending(false);
    setCode("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setView("reset-code");
  }

  async function handleVerifyResetCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setError(`Le mot de passe doit faire au moins ${PASSWORD_MIN_LENGTH} caractères.`);
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setPending(true);

    const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: "recovery" });

    if (error || !data.user) {
      setPending(false);
      setError("Code invalide ou expiré. Vérifie le code reçu par email, ou demande-en un nouveau.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

    if (updateError) {
      setPending(false);
      setError("Code vérifié, mais impossible d'enregistrer le mot de passe. Réessaie.");
      return;
    }

    await redirectForUser(data.user.id);
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
              {useEmailCode
                ? "Reçois un code de connexion par email."
                : "Connecte-toi avec ton email et ton mot de passe."}
            </p>

            {!useEmailCode ? (
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
                    onClick={handleSendResetCode}
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
                    setUseEmailCode(true);
                    setError(null);
                  }}
                  className="text-center text-sm text-encre/60 underline"
                >
                  Se connecter avec un code reçu par email à la place
                </button>
              </form>
            ) : (
              <form onSubmit={handleSendLoginCode} className="mt-6 flex flex-col gap-3">
                <label className="text-sm font-medium text-encre" htmlFor="email-code">
                  Adresse email
                </label>
                <input
                  id="email-code"
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
                  {pending ? "Envoi..." : "Recevoir le code"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUseEmailCode(false);
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

        {view === "email-code" && (
          <form onSubmit={handleVerifyLoginCode} className="mt-6 flex flex-col gap-3">
            <p className="text-sm text-encre/70">
              Code envoyé à {email}. Vérifie tes spams s&apos;il n&apos;arrive
              pas après quelques minutes.
            </p>
            <label className="text-sm font-medium text-encre" htmlFor="login-otp">
              Code à 6 chiffres
            </label>
            <input
              id="login-otp"
              name="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              autoFocus
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="rounded-md border border-ligne px-3 py-2 text-center text-lg tracking-[0.3em] focus:border-vert-actif focus:outline-none"
            />

            {error && <p className="text-sm text-erreur">{error}</p>}

            <button
              type="submit"
              disabled={pending}
              className="mt-2 rounded-md bg-vert-actif px-4 py-2 text-sm font-medium text-ivoire hover:bg-vert-sapin disabled:opacity-50"
            >
              {pending ? "Vérification..." : "Se connecter"}
            </button>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={handleSendLoginCode}
                disabled={pending}
                className="text-vert-actif underline disabled:opacity-50"
              >
                Renvoyer le code
              </button>
              <button
                type="button"
                onClick={() => {
                  setView("password");
                  setError(null);
                }}
                className="text-encre/60 underline"
              >
                Retour
              </button>
            </div>
          </form>
        )}

        {view === "reset-code" && (
          <form onSubmit={handleVerifyResetCode} className="mt-6 flex flex-col gap-3">
            <p className="text-sm text-encre/70">
              Si un compte existe avec l&apos;adresse {email}, un code vient
              de lui être envoyé par email. Vérifie tes spams s&apos;il
              n&apos;arrive pas après quelques minutes.
            </p>
            <label className="text-sm font-medium text-encre" htmlFor="reset-otp">
              Code à 6 chiffres
            </label>
            <input
              id="reset-otp"
              name="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              autoFocus
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="rounded-md border border-ligne px-3 py-2 text-center text-lg tracking-[0.3em] focus:border-vert-actif focus:outline-none"
            />

            <label className="text-sm font-medium text-encre" htmlFor="reset-new-password">
              Nouveau mot de passe
            </label>
            <input
              id="reset-new-password"
              name="new-password"
              type="password"
              required
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="rounded-md border border-ligne px-3 py-2 text-sm focus:border-vert-actif focus:outline-none"
            />

            <label className="text-sm font-medium text-encre" htmlFor="reset-confirm-password">
              Confirme le mot de passe
            </label>
            <input
              id="reset-confirm-password"
              name="confirm-password"
              type="password"
              required
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              placeholder="••••••••"
              className="rounded-md border border-ligne px-3 py-2 text-sm focus:border-vert-actif focus:outline-none"
            />

            {error && <p className="text-sm text-erreur">{error}</p>}

            <button
              type="submit"
              disabled={pending}
              className="mt-2 rounded-md bg-vert-actif px-4 py-2 text-sm font-medium text-ivoire hover:bg-vert-sapin disabled:opacity-50"
            >
              {pending ? "Enregistrement..." : "Réinitialiser le mot de passe"}
            </button>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={handleSendResetCode}
                disabled={pending}
                className="text-vert-actif underline disabled:opacity-50"
              >
                Renvoyer le code
              </button>
              <button
                type="button"
                onClick={() => {
                  setView("password");
                  setError(null);
                }}
                className="text-encre/60 underline"
              >
                Retour
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
