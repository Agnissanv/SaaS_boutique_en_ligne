"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth-constants";

/**
 * Inscription vendeur — ajoutée le 13/09/2026 à la demande d'Isaac ("vu
 * qu'on repart de façon propre, optimise bien les champs de signup/login") :
 * jusqu'ici, créer un compte se faisait uniquement en cliquant sur un lien
 * magique reçu par email (`signInWithOtp` avec `shouldCreateUser: true` dans
 * connexion-form.tsx), sans jamais capturer le nom du vendeur — le profil
 * héritait par défaut de la partie locale de l'email comme nom d'affichage.
 *
 * Cette page devient le point d'entrée normal pour créer un compte : email +
 * mot de passe + nom, avec le mot de passe choisi immédiatement (pas besoin
 * d'un aller-retour email pour en définir un comme avant). Le nom saisi est
 * transmis via `options.data.display_name` à `signUp()` — voir la migration
 * 0009 qui adapte le trigger `handle_new_user()` pour le récupérer.
 *
 * Le lien magique reste disponible à la connexion (/connexion) pour qui
 * préfère ne pas retenir de mot de passe, mais ne crée plus de compte
 * implicitement (`shouldCreateUser: false` désormais) : la création passe
 * uniquement par ici, pour garantir qu'un profil complet existe toujours.
 *
 * Ne collecte pas le nom de la boutique : cette étape reste dans
 * /dashboard/boutique (déjà fonctionnelle, avec upload logo/couverture,
 * catégorie, slug...), pour ne pas dupliquer ce formulaire ni créer une
 * boutique à moitié remplie avant que le vendeur ait vu le dashboard.
 */
export function InscriptionForm() {
  const router = useRouter();
  const supabase = createClient();

  type View = "form" | "confirmation-envoyee" | "compte-existant";
  const [view, setView] = useState<View>("form");

  const [displayName, setDisplayName] = useState("");
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
        data: { display_name: trimmedName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
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

    // Anti-énumération côté Supabase : pour un email déjà utilisé et déjà
    // confirmé, `signUp` ne renvoie pas d'erreur mais un utilisateur dont
    // `identities` est vide (aucune nouvelle identité créée).
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setView("compte-existant");
      return;
    }

    if (data.session) {
      // Confirmation email désactivée côté projet : compte actif immédiat.
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user!.id)
        .maybeSingle();

      router.push(profile?.role === "admin" ? "/admin" : "/dashboard");
      router.refresh();
      return;
    }

    // Confirmation email activée : pas de session tant que le lien reçu
    // n'est pas cliqué.
    setView("confirmation-envoyee");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Créer un compte</h1>

        {view === "form" && (
          <>
            <p className="mt-1 text-sm text-gray-600">
              Ouvre ta boutique en ligne en quelques minutes.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
              <label className="text-sm font-medium text-gray-700" htmlFor="displayName">
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
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />

              <label className="text-sm font-medium text-gray-700" htmlFor="email">
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
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />

              <label className="text-sm font-medium text-gray-700" htmlFor="password">
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
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />

              <label className="text-sm font-medium text-gray-700" htmlFor="confirmPassword">
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
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={pending}
                className="mt-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {pending ? "Création..." : "Créer mon compte"}
              </button>
            </form>

            <p className="mt-4 text-center text-sm text-gray-500">
              Déjà un compte ?{" "}
              <Link href="/connexion" className="underline">
                Se connecter
              </Link>
            </p>
          </>
        )}

        {view === "confirmation-envoyee" && (
          <div className="mt-6 flex flex-col gap-3">
            <p className="text-sm text-gray-600">
              Compte créé. Un email de confirmation vient d&apos;être envoyé
              à {email} — clique sur le lien qu&apos;il contient pour
              l&apos;activer. Pense à vérifier tes spams s&apos;il n&apos;arrive
              pas après quelques minutes.
            </p>
            <Link href="/connexion" className="text-sm text-gray-500 underline">
              Retour à la connexion
            </Link>
          </div>
        )}

        {view === "compte-existant" && (
          <div className="mt-6 flex flex-col gap-3">
            <p className="text-sm text-gray-600">
              Un compte existe déjà avec l&apos;adresse {email}.
            </p>
            <Link href="/connexion" className="text-sm text-gray-500 underline">
              Se connecter
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
