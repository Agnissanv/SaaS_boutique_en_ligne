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
    return <div className={`${className ?? ""} bg-gray-100`} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- image uploadée par le vendeur, source dynamique
    <img src={src} alt={alt} className={className} onError={() => setBroken(true)} />
  );
}
