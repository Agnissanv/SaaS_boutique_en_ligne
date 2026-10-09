import type { Metadata } from "next";
import Link from "next/link";
import { StatusPage, statusPrimaryButton, statusSecondaryButton } from "@/components/status-page";

export const metadata: Metadata = {
  title: "Page introuvable — KEVA",
};

/**
 * Page 404 (09/10/2026) — affichée pour toute adresse inconnue et pour chaque
 * `notFound()` du site (boutique, produit, commande, article de blog
 * introuvables...). Next.js ajoute lui-même `noindex` et le code HTTP 404.
 *
 * Cas le plus courant sur KEVA : un lien partagé sur WhatsApp vers une
 * boutique ou un produit retiré depuis — d'où le message, et la recherche
 * directe pour retrouver un article similaire sans repasser par l'accueil.
 */
export default function NotFound() {
  return (
    <StatusPage
      code="404"
      title="Cette page est introuvable"
      message={
        <p>
          Le lien est peut-être erroné, ou la boutique ou l&apos;article a été retiré par son vendeur.
        </p>
      }
    >
      <div className="flex w-full flex-col items-center gap-6">
        <form action="/" method="get" role="search" className="flex w-full max-w-md gap-2">
          <label htmlFor="not-found-search" className="sr-only">
            Rechercher un article
          </label>
          <input
            id="not-found-search"
            type="search"
            name="q"
            placeholder="Rechercher un article…"
            className="min-w-0 flex-1 rounded-full border border-ligne bg-white px-4 py-2.5 text-sm text-encre placeholder:text-encre/50 focus:border-vert-actif focus:outline-none"
          />
          <button type="submit" className="shrink-0 rounded-full bg-vert-sapin px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-vert-actif">
            Rechercher
          </button>
        </form>
        <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
          <Link href="/" className={statusPrimaryButton}>
            Retour à l&apos;accueil
          </Link>
          <Link href="/categories" className={statusSecondaryButton}>
            Parcourir les catégories
          </Link>
        </div>
      </div>
    </StatusPage>
  );
}
