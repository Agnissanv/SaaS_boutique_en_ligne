"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth-constants";

/**
 * Inscription client — ajoutée le 15/09/2026 (§ comptes client optionnels,
 * migration 0014). Calquée sur inscription-form.tsx (vendeur), avec deux
 * différences : `role: "customer"` transmis dans les métadonnées de
 * `signUp()` (handle_new_user() ne l'accepte que pour ce rôle précis, jamais
 * pour 'admin' — voir la migration), et un champ téléphone collecté dès
 * l'inscription, nécessaire pour proposer ensuite le rattachement des
 * commandes passées en invité (claim_guest_orders).
 *
 * Après création réussie ET session active, on appelle claim_guest_orders
 * une première fois automatiquement (best-effort, jamais bloquant pour la
 * redirection) : si le client a déjà commandé avec ce numéro avant de créer
 * son compte, il retrouve tout de suite son historique sur /compte.
 *
 * Recolorée en charte KEVA le 15/09/2026 (côté client) — même carte/logo que
 * inscription-form.tsx (vendeur), seul le lien de retour pointe vers
 * /compte/connexion au lieu de /connexion.
 */
export function InscriptionClientForm() {
  const router = useRouter();
  const supabase = createClient();

  type View = "form" | "confirmation-envoyee" | "compte-existant";
  const [view, setView] = useState<View>("form");

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = displayName.trim();
    if (trimmedName.length < 2) {
      setError("Indique ton nom (au moins 2 caractères).");
      return;
    }
    if (coalescePhone(phone).length < 8) {
      setError("Indique un numéro de téléphone valide.");
      return;
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Le mot de passe doit faire au moins ${PASSWORD_MIN_LENGTH} caractères.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setPending(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: trimmedName, phone: phone.trim(), role: "customer" },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/compte`,
      },
    });

    setPending(false);

    if (signUpError) {
      setError(
        signUpError.message.includes("rate limit")
          ? "Trop de tentatives : réessaie dans quelques minutes."
          : "Impossible de créer le compte. Vérifie l'adresse email."
      );
      return;
    }

    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setView("compte-existant");
      return;
    }

    if (data.session) {
      // Best-effort : ne bloque jamais l'accès au compte si ça échoue.
      // (`.catch()` direct sur le builder Postgrest n'existe pas — c'est un
      // PromiseLike, pas une vraie Promise — d'où le try/catch.)
      try {
        await supabase.rpc("claim_guest_orders");
      } catch {
        // ignore
      }
      router.push("/compte");
      router.refresh();
      return;
    }

    setView("confirmation-envoyee");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 bg-brume">
      <Link href="/" className="mx-auto mb-6 flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- logo statique */}
        <img src="/keva-logo.jpg" alt="KEVA" className="h-10 w-10 rounded-md object-cover" />
        <span className="font-display text-xl font-semibold tracking-tight text-vert-sapin">KEVA</span>
      </Link>
      <div className="rounded-xl border border-ligne bg-white p-6 shadow-sm">
        <h1 className="font-display text-xl font-semibold text-encre">Créer un compte</h1>

        {view === "form" && (
          <>
            <p className="mt-1 text-sm text-encre/70">
              Retrouve facilement l&apos;historique de tes commandes, chez
              n&apos;importe quel vendeur de la plateforme.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
              <label className="text-sm font-medium text-encre" htmlFor="displayName">
                Nom complet
              </label>
              <input
                id="displayName"
                name="name"
                type="text"
                required
                autoFocus
                autoComplete="name"
                minLength={2}
                maxLength={80}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ex : Awa Koné"
                className="rounded-md border border-ligne px-3 py-2 text-sm focus:border-vert-actif focus:outline-none"
              />

              <label className="text-sm font-medium text-encre" htmlFor="phone">
                Téléphone
              </label>
              <input
                id="phone"
                name="tel"
                type="tel"
                required
                autoComplete="tel"
                placeholder="+225 07 00 00 00 00"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="rounded-md border border-ligne px-3 py-2 text-sm focus:border-vert-actif focus:outline-none"
              />
              <p className="text-xs text-encre/50">
                Sert à retrouver automatiquement tes commandes déjà passées
                avec ce numéro, sans compte.
              </p>

              <label className="text-sm font-medium text-encre" htmlFor="email">
                Adresse email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="toi@exemple.com"
                className="rounded-md border border-ligne px-3 py-2 text-sm focus:border-vert-actif focus:outline-none"
              />

              <label className="text-sm font-medium text-encre" htmlFor="password">
                Mot de passe
              </label>
              <input
                id="password"
                name="new-password"
                type="password"
                required
                autoComplete="new-password"
                minLength={PASSWORD_MIN_LENGTH}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="rounded-md border border-ligne px-3 py-2 text-sm focus:border-vert-actif focus:outline-none"
              />

              <label className="text-sm font-medium text-encre" htmlFor="confirmPassword">
                Confirme le mot de passe
              </label>
              <input
                id="confirmPassword"
                name="confirm-password"
                type="password"
                required
                autoComplete="new-password"
                minLength={PASSWORD_MIN_LENGTH}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="rounded-md border border-ligne px-3 py-2 text-sm focus:border-vert-actif focus:outline-none"
              />

              {error && <p className="text-sm text-erreur">{error}</p>}

              <button
                type="submit"
                disabled={pending}
                className="mt-2 rounded-md bg-cuivre-profond px-4 py-2 text-sm font-medium text-ivoire hover:bg-cuivre disabled:opacity-50"
              >
                {pending ? "Création..." : "Créer mon compte"}
              </button>
            </form>

            <p className="mt-4 text-center text-sm text-encre/60">
              Déjà un compte ?{" "}
              <Link href="/compte/connexion" className="text-vert-actif underline">
                Se connecter
              </Link>
            </p>
          </>
        )}

        {view === "confirmation-envoyee" && (
          <div className="mt-6 flex flex-col gap-3">
            <p className="text-sm text-encre/70">
              Compte créé. Un email de confirmation vient d&apos;être envoyé
              à {email} — clique sur le lien qu&apos;il contient pour
              l&apos;activer. Pense à vérifier tes spams s&apos;il n&apos;arrive
              pas après quelques minutes.
            </p>
            <Link href="/compte/connexion" className="text-sm text-vert-actif underline">
              Retour à la connexion
            </Link>
          </div>
        )}

        {view === "compte-existant" && (
          <div className="mt-6 flex flex-col gap-3">
            <p className="text-sm text-encre/70">
              Un compte existe déjà avec l&apos;adresse {email}.
            </p>
            <Link href="/compte/connexion" className="text-sm text-vert-actif underline">
              Se connecter
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function coalescePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}
