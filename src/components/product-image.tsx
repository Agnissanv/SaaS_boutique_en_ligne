"use client";

import { useState } from "react";
import Image from "next/image";

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
 *
 * Passé à `next/image` le 16/09/2026 (enrichissement performance, voir
 * decisions-techniques.md) — jusque-là un `<img>` brut, avec le
 * eslint-disable qui va avec. Ce composant est le SEUL point de rendu des
 * photos produit dans tout le projet (fiche produit, page boutique,
 * marketplace, cartes), donc le seul endroit à changer pour que toutes ces
 * pages bénéficient du redimensionnement responsive et du lazy-loading
 * automatique de `next/image` — voir `next.config.ts` pour l'autorisation du
 * domaine Supabase Storage. `fill` plutôt que `width`/`height` fixes : tous
 * les appelants dimensionnent déjà la vignette par une classe Tailwind sur
 * le conteneur (`aspect-square w-full`, ou une taille fixe pour le collage du
 * hero) — `fill` réutilise cette boîte telle quelle sans dupliquer la
 * dimension ailleurs. `sizes` approxime les grilles réellement utilisées
 * (2 à 6 colonnes selon la largeur d'écran, cf. page d'accueil/boutique) :
 * une valeur légèrement pessimiste plutôt qu'exacte par page, pour rester un
 * seul composant partagé.
 *
 * Fondu à l'arrivée ajouté le 22/09/2026 (retour d'Isaac sur la fluidité
 * générale du site : "image..."). Avant, la photo apparaissait d'un coup dès
 * que le navigateur avait fini de la décoder — sec sur une connexion lente,
 * et visible même sur bonne connexion vu le nombre de vignettes chargées
 * d'un coup sur une grille. `next/image` appelle `onLoad` de façon fiable,
 * y compris pour une image déjà en cache navigateur (contrairement à un
 * `<img>` brut) : pas de cas particulier à gérer ici.
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
  const [loaded, setLoaded] = useState(false);

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
    <div className={`relative overflow-hidden bg-brume ${className ?? ""}`}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(min-width: 1280px) 16vw, (min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
        className={`object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
        onError={() => setBroken(true)}
      />
    </div>
  );
}
