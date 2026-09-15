"use client";

import { useState } from "react";

/**
 * Image produit avec repli propre si l'URL est cassée (fichier supprimé du
 * Storage, upload interrompu...) — remarqué le 13/09/2026 sur un produit de
 * test dont la photo ne chargeait plus : sans repli, le navigateur affiche
 * sa propre icône d'image cassée, peu engageant sur une page marketplace.
 * Extrait en composant client séparé (plutôt que directement dans
 * `ProductCard`, un Server Component) : `onError` est un gestionnaire
 * d'événement, qui a besoin d'un Client Component pour s'exécuter.
 *
 * Icône ajoutée le 15/09/2026 (signalé par Isaac, capture d'écran à l'appui,
 * sur la bande "Meilleures ventes" de la page d'accueil) : le repli était
 * jusque-là un simple rectangle `bg-brume` totalement vide, indiscernable
 * d'un bug de chargement — repéré aussitôt qu'un vrai produit sans photo
 * (boutique de test) s'est retrouvé mis en avant sur la page d'accueil.
 * Une icône discrète centrée signale sans ambiguïté "pas de photo" plutôt que
 * de laisser un vide qui a l'air cassé. Même trait que les autres icônes
 * dessinées à la main du projet (`category-icon.tsx`, `admin-icons.tsx`) :
 * `currentColor`, épaisseur `1.5`, pas de librairie.
 */
export function ProductImage({
  src,
  alt,
  className,
}: {
  src?: string;
  alt: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);

  if (!src || broken) {
    return (
      <div
        className={`${className ?? ""} flex items-center justify-center bg-brume text-encre/25`}
        role="img"
        aria-label={alt}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-1/3 w-1/3">
          <rect x="3" y="4" width="18" height="16" rx="2" strokeLinejoin="round" />
          <circle cx="8.5" cy="9.5" r="1.5" />
          <path d="M21 16l-5.5-5.5a1.5 1.5 0 0 0-2.12 0L5 19" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- image uploadée par le vendeur, source dynamique
    <img src={src} alt={alt} className={className} onError={() => setBroken(true)} />
  );
}
