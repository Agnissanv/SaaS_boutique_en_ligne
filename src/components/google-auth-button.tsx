"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Bouton "Continuer avec Google" partagé par les quatre formulaires
 * d'authentification (connexion + inscription, vendeur + client) — ajouté le
 * 21/09/2026 à la demande d'Isaac ("permettre à tous ceux qui se connectent...
 * de pouvoir créer le compte avec Google directement, au lieu de toujours
 * passer par 4000 chemins").
 *
 * Un seul bouton pour connexion ET inscription : `signInWithOAuth` gère les
 * deux cas d'un coup côté Supabase (crée le compte au premier passage,
 * reconnecte ensuite) — pas besoin de deux variantes.
 *
 * `portal="customer"` ajoute un signal `?portal=customer` repris par
 * `/auth/callback` : Google ne fournit aucune métadonnée de rôle, donc
 * `handle_new_user()` (migration 0030) assigne 'vendor' par défaut à tout
 * compte OAuth tout juste créé — ce signal permet à la route de callback de
 * corriger le rôle en 'customer' pour un compte fraîchement créé depuis ce
 * portail (voir auth/callback/route.ts pour le détail et la garde-fou sur les
 * comptes déjà existants).
 *
 * IMPORTANT (déploiement) : ce bouton ne fonctionnera qu'une fois Isaac ayant
 * (1) créé un OAuth Client ID Google Cloud, et (2) activé + configuré le
 * provider Google dans le dashboard Supabase Auth — étapes manuelles, côté
 * Google Cloud Console et Supabase, qu'aucun outil ici ne peut faire à sa
 * place.
 */
export function GoogleAuthButton({ portal }: { portal?: "customer" }) {
  const supabase = createClient();

  async function handleClick() {
    const redirectTo = portal
      ? `${window.location.origin}/auth/callback?portal=${portal}`
      : `${window.location.origin}/auth/callback`;

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center justify-center gap-2 rounded-md border border-ligne bg-white px-4 py-2 text-sm font-medium text-encre hover:bg-brume"
    >
      <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
        <path
          fill="#FFC107"
          d="M43.6 20.5H42V20.4H24v7.2h11.3c-1.6 4.6-6 7.9-11.3 7.9-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.1-5.1C33.6 6 29 4.2 24 4.2 12.9 4.2 4 13.1 4 24.2s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.7z"
        />
        <path
          fill="#FF3D00"
          d="M6.3 14.7l5.9 4.3C13.9 15.5 18.6 12.4 24 12.4c3 0 5.8 1.1 7.9 3l5.1-5.1C33.6 6 29 4.2 24 4.2c-7.5 0-13.9 4.2-17.2 10.4z"
        />
        <path
          fill="#4CAF50"
          d="M24 44.2c4.9 0 9.4-1.9 12.7-4.9l-5.9-5c-1.9 1.4-4.3 2.2-6.9 2.2-5.3 0-9.7-3.3-11.3-7.9l-6 4.6C9.9 40 16.4 44.2 24 44.2z"
        />
        <path
          fill="#1976D2"
          d="M43.6 20.5H42V20.4H24v7.2h11.3c-.8 2.2-2.2 4.1-4.1 5.5l5.9 5c-.4.4 6.6-4.8 6.6-14.5 0-1.3-.1-2.6-.4-3.7z"
        />
      </svg>
      Continuer avec Google
    </button>
  );
}
