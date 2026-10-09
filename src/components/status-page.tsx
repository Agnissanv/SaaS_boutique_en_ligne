import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Mise en page commune des pages d'état (09/10/2026) : 404
 * (`app/not-found.tsx`), erreur d'une page (`app/error.tsx`) et erreur globale
 * (`app/global-error.tsx`). Même en-tête minimal que les pages secondaires
 * (FAQ, tarifs...) : logo cliquable vers l'accueil, puis un message centré et
 * des actions. Aucun hook : utilisable aussi bien depuis un Server Component
 * (404) que depuis les error boundaries, qui sont des Client Components.
 */
export function StatusPage({
  code,
  title,
  message,
  children,
}: {
  /** Grand repère visuel au-dessus du titre (« 404 », « Oups »). Décoratif. */
  code: string;
  title: string;
  message: ReactNode;
  /** Boutons / liens d'action. */
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col bg-brume">
      <header className="border-b border-ligne bg-white px-4 py-4">
        <Link href="/" className="mx-auto flex w-full max-w-2xl items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo statique */}
          <img src="/keva-logo.jpg" alt="KEVA" className="h-8 w-8 rounded-md object-cover" />
          <span className="font-display text-lg font-bold tracking-wide text-vert-sapin">KEVA</span>
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <p aria-hidden="true" className="font-display text-7xl font-black leading-none tracking-tight text-vert-actif/25 sm:text-8xl">
          {code}
        </p>
        <h1 className="mt-4 text-balance font-display text-2xl font-bold text-encre sm:text-3xl">{title}</h1>
        <div className="mt-3 max-w-md text-sm leading-relaxed text-encre/75">{message}</div>
        <div className="mt-8 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row sm:justify-center">
          {children}
        </div>
      </main>
    </div>
  );
}

/** Classes des deux styles de bouton des pages d'état. */
export const statusPrimaryButton =
  "inline-flex w-full items-center justify-center rounded-full bg-vert-actif px-6 py-3 text-sm font-semibold text-white transition hover:bg-vert-sapin sm:w-auto";
export const statusSecondaryButton =
  "inline-flex w-full items-center justify-center rounded-full border border-ligne bg-white px-6 py-3 text-sm font-medium text-encre transition hover:border-vert-actif hover:text-vert-actif sm:w-auto";
