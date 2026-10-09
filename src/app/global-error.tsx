"use client";

import "./globals.css";
import Link from "next/link";
import { useEffect } from "react";
import { StatusPage, statusPrimaryButton, statusSecondaryButton } from "@/components/status-page";

/**
 * Erreur globale (09/10/2026) — dernier filet, seulement quand le layout
 * racine lui-même plante. Remplace alors tout le document : il faut donc ses
 * propres <html>/<body> et l'import des styles globaux (les polices de marque
 * du layout ne sont pas chargées ici, le texte retombe sur la police système).
 * `metadata` n'est pas supporté dans ce fichier : titre via <title> (React 19).
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="fr" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <title>Erreur — KEVA</title>
        <StatusPage
          code="Oups"
          title="Le site rencontre un problème"
          message={
            <>
              <p>Réessaie dans un instant. Si le problème continue, contacte-nous.</p>
              {error.digest ? (
                <p className="mt-3 font-mono text-xs text-encre/50">Référence : {error.digest}</p>
              ) : null}
            </>
          }
        >
          <button type="button" onClick={() => retry()} className={statusPrimaryButton}>
            Réessayer
          </button>
          {/* <a> plutôt que <Link> : on veut un rechargement complet, le
              layout racine étant justement en panne. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- rechargement complet voulu */}
          <a href="/" className={statusSecondaryButton}>
            Retour à l&apos;accueil
          </a>
          <Link href="/contact" className={statusSecondaryButton}>
            Nous contacter
          </Link>
        </StatusPage>
      </body>
    </html>
  );
}
