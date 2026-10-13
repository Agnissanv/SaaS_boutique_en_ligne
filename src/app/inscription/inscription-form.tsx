"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PASSWORD_MIN_LENGTH, roleHomePath } from "@/lib/auth-constants";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { PartnerCodeField, type PartnerCodeStatus } from "@/components/partner-code-field";
import { safeInternalPath } from "@/lib/utils/safe-path";
import {
  PARTNER_COOKIE,
  PARTNER_COOKIE_MAX_AGE,
  normalizePartnerCode,
  normalizePartnerSource,
  serializePartnerCookie,
} from "@/lib/partners";

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
 *
 * `?ref=<slug>` (23/09/2026, système de parrainage — voir
 * decisions-techniques.md et supabase/migrations/0045_referral_system.sql) :
 * lien de parrainage généré sur /dashboard/parrainage par un vendeur déjà
 * inscrit. Transmis via `options.data.referred_by_code` à signUp() — même
 * mécanisme que `display_name` (migration 0009) — et capturé par
 * `handle_new_user()` dans `profiles.referred_by_code`, consommé plus tard
 * par `saveShop()` (dashboard/boutique/actions.ts) au moment où ce nouveau
 * vendeur crée sa propre boutique. Route déjà en `dynamic = "force-dynamic"`
 * (page.tsx), donc pas de souci de prerendering avec `useSearchParams()` ici
 * (même raisonnement que (customer)/compte/inscription/inscription-form.tsx).
 * Pour le chemin Google (aucune métadonnée arbitraire transmissible), voir
 * `GoogleAuthButton` et `/auth/callback/route.ts`.
 *
 * `?agent=<code>` (23/09/2026, parrainage COMMERCIAL — voir
 * decisions-techniques.md et supabase/migrations/0046_commercial_referral_system.sql) :
 * même mécanisme que `?ref=` ci-dessus mais pour un lien de commercial
 * plutôt qu'un lien de vendeur — canal complètement séparé (colonne
 * `referred_by_agent_code`, jamais mélangé avec `referred_by_code`).
 *
 * Code partenaire (13/10/2026, programme partenaire influenceur — voir
 * supabase/migrations/0061_partner_program.sql) : pré-rempli quand le
 * visiteur est arrivé par le lien d'une partenaire (`partnerPrefill`, lu par
 * page.tsx dans le cookie posé par /p/[code]), sinon saisissable à la main.
 * Transmis via `options.data.partner_code` / `partner_source` (métadonnées
 * du compte) et consommé par `saveShop()` à la création de la boutique —
 * aucune colonne de profil ni trigger à modifier. Pour Google, le code saisi
 * est écrit dans le même cookie juste avant de partir (`beforeRedirect`).
 */
export function InscriptionForm({
  partnerPrefill,
}: {
  partnerPrefill: { code: string; source: string } | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const searchParams = useSearchParams();
  const referredByCode = searchParams.get("ref");
  const referredByAgentCode = searchParams.get("agent");
  // `?suite=` (13/10/2026) : page où revenir une fois le compte créé (ex. une
  // invitation partenaire), y compris après le lien de confirmation par email.
  const suite = safeInternalPath(searchParams.get("suite"));

  type View = "form" | "confirmation-envoyee" | "compte-existant";
  const [view, setView] = useState<View>("form");

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partnerCode, setPartnerCode] = useState(partnerPrefill?.code ?? "");
  const [partnerStatus, setPartnerStatus] = useState<PartnerCodeStatus>({ state: "empty" });

  // Canal d'arrivée (tiktok, instagram...) seulement si le code n'a pas été
  // changé à la main ; un code tapé compte comme « Code saisi ».
  function partnerMetadata(): { partner_code?: string; partner_source?: string } {
    const code = normalizePartnerCode(partnerCode);
    if (!code) return {};
    return {
      partner_code: code,
      partner_source: partnerPrefill && partnerPrefill.code === code ? partnerPrefill.source : "code",
    };
  }

  function rememberPartnerCodeForGoogle() {
    const { partner_code, partner_source } = partnerMetadata();
    if (!partner_code || partnerStatus.state === "invalid") return;
    const value = serializePartnerCookie(partner_code, normalizePartnerSource(partner_source));
    document.cookie = `${PARTNER_COOKIE}=${value}; Max-Age=${PARTNER_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
  }

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
    if (partnerCode && partnerStatus.state === "invalid") {
      setError("Ce code partenaire n'existe pas. Corrige-le ou laisse le champ vide.");
      return;
    }

    setPending(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: trimmedName,
          ...(referredByCode ? { referred_by_code: referredByCode } : {}),
          ...(referredByAgentCode ? { referred_by_agent_code: referredByAgentCode } : {}),
          ...partnerMetadata(),
        },
        emailRedirectTo: `${window.location.origin}/auth/callback${
          suite ? `?next=${encodeURIComponent(suite)}` : ""
        }`,
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

      router.push(suite ?? roleHomePath(profile?.role));
      router.refresh();
      return;
    }

    // Confirmation email activée : pas de session tant que le lien reçu
    // n'est pas cliqué.
    setView("confirmation-envoyee");
  }

  return (
    <div className="w-full mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 bg-brume">
      <Link href="/" className="mx-auto mb-6 flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- logo statique */}
        <img src="/keva-logo.jpg" alt="KEVA" className="h-10 w-10 rounded-md object-cover" />
        <span className="font-display text-xl font-bold tracking-wide text-vert-sapin">KEVA</span>
      </Link>
      <div className="rounded-xl border border-ligne bg-white p-6 shadow-sm">
        {/* Accroche de marque intégrée visuellement ici le 17/09/2026 —
            jusque-là présente uniquement dans le <title> (layout.tsx). Cette
            page d'inscription vendeur est l'endroit naturel : c'est
            exactement la promesse qu'elle tient. */}
        <h1 className="font-display text-xl font-semibold text-encre">
          Crée ta boutique en ligne en 5 minutes
        </h1>

        {view === "form" && (
          <>
            <p className="mt-1 text-sm text-encre/70">
              Ton nom, ton email et un mot de passe suffisent pour commencer.{" "}
              {/* Ajouté le 29/09/2026, même chantier que /tarifs (voir ce
                  fichier) : quelqu'un qui arrive directement sur cette page
                  (lien direct, pub...) sans passer par la marketplace n'a
                  toujours aucun moyen d'y voir les tarifs avant de créer un
                  compte. */}
              <Link href="/tarifs" className="text-vert-actif underline">
                Voir les tarifs
              </Link>
              .
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

              <PartnerCodeField
                value={partnerCode}
                onChange={setPartnerCode}
                onStatusChange={setPartnerStatus}
                initiallyOpen={Boolean(partnerPrefill)}
              />

              {error && <p className="text-sm text-erreur">{error}</p>}

              <button
                type="submit"
                disabled={pending}
                className="mt-2 rounded-md bg-vert-actif px-4 py-2 text-sm font-medium text-ivoire hover:bg-vert-sapin disabled:opacity-50"
              >
                {pending ? "Création..." : "Créer mon compte"}
              </button>
            </form>

            <div className="mt-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-ligne" />
              <span className="text-xs text-encre/40">ou</span>
              <div className="h-px flex-1 bg-ligne" />
            </div>
            <div className="mt-4">
              <GoogleAuthButton
                referralCode={referredByCode ?? undefined}
                agentCode={referredByAgentCode ?? undefined}
                beforeRedirect={rememberPartnerCodeForGoogle}
                next={suite ?? undefined}
              />
            </div>

            <p className="mt-4 text-center text-sm text-encre/60">
              Déjà un compte ?{" "}
              <Link
                href={suite ? `/connexion?suite=${encodeURIComponent(suite)}` : "/connexion"}
                className="text-vert-actif underline"
              >
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
            <Link href="/connexion" className="text-sm text-vert-actif underline">
              Retour à la connexion
            </Link>
          </div>
        )}

        {view === "compte-existant" && (
          <div className="mt-6 flex flex-col gap-3">
            <p className="text-sm text-encre/70">
              Un compte existe déjà avec l&apos;adresse {email}.
            </p>
            <Link href="/connexion" className="text-sm text-vert-actif underline">
              Se connecter
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
