"use client";

import Link from "next/link";
import { useEffect } from "react";
import { StatusPage, statusPrimaryButton, statusSecondaryButton } from "@/components/status-page";

/**
 * Page d'erreur (09/10/2026) — remplace la page anglaise par défaut quand une
 * page plante au rendu (base injoignable, bug...). Le pied de page et la barre
 * de navigation du layout racine restent affichés autour.
 *
 * `retry()` (Next.js 16) recharge les données de la page puis la ré-affiche :
 * suffisant pour une coupure passagère. En production, le message réel de
 * l'erreur n'est jamais transmis au navigateur, seulement un identifiant
 * (`digest`) — affiché ici pour qu'un client puisse le donner au support et
 * qu'on le retrouve dans les journaux Vercel.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Point d'accroche pour un futur service de suivi d'erreurs (Sentry...).
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      code="Oups"
      title="Un problème est survenu"
      message={
        <>
          <p>Ce n&apos;est pas de ta faute. Réessaie dans un instant ; si le problème continue, contacte-nous.</p>
          {error.digest ? (
            <p className="mt-3 font-mono text-xs text-encre/50">Référence : {error.digest}</p>
          ) : null}
        </>
      }
    >
      <button type="button" onClick={() => retry()} className={statusPrimaryButton}>
        Réessayer
      </button>
      <Link href="/" className={statusSecondaryButton}>
        Retour à l&apos;accueil
      </Link>
      <Link href="/contact" className={statusSecondaryButton}>
        Nous contacter
      </Link>
    </StatusPage>
  );
}
