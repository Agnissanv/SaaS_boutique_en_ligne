"use client";

import { useEffect, useRef, useState } from "react";
import { ProductImage } from "@/components/product-image";
import { HeroFeaturedSlideshow } from "@/components/hero-featured-slideshow";
import type { MarketplaceCardProduct } from "@/components/product-card";

/**
 * Nuage de photos du hero — remplace le collage fixe à 3 cases dans un
 * carré de 256px (28/09/2026, refonte visuelle du hero — voir
 * hero-headline.tsx pour le contexte : Isaac a jugé ce collage trop "patron
 * SaaS générique"). Toujours de vraies photos produit, jamais de stock —
 * mêmes données qu'avant (`heroThumbnails`/`heroSlideshowProducts`, déjà
 * chargées dans page.tsx, aucune requête supplémentaire ajoutée ici).
 *
 * Dérive légèrement au scroll (translation verticale, amplitude différente
 * par case pour casser l'effet de grille) plutôt que de rester figé une
 * fois affiché — en CSS/scroll natif (écouteur passif throttlé par rAF),
 * pas via une librairie de scroll dédiée : le reste du site n'en utilise
 * aucune, pas de raison d'en introduire une pour cette seule zone.
 *
 * `prefers-reduced-motion` : l'effet de dérive ne démarre jamais (l'état
 * `progress` reste à 0), les cases restent à leur position de base — même
 * règle que `HeroFeaturedSlideshow`/`HeroMobileSlideshow` juste à côté.
 */

// Position + rotation + amplitude de dérive au scroll, par case — regroupées
// ici plutôt que séparées (position en classe Tailwind, rotation à part)
// car la rotation doit rejoindre le `translateY` calculé au scroll dans UN
// SEUL `transform` inline : deux `transform` sur le même élément (une classe
// Tailwind `rotate-*` et un style inline `translateY`) ne s'additionnent
// pas, le second écrase le premier. Values de dérive différentes par case
// (jamais le même mouvement répété quatre fois), pour que le nuage se lise
// comme dispersé plutôt que comme une grille qui glisse en bloc.
// Disposition revue après un aperçu statique (28/09/2026) : une première
// passe à 4 cases + vedette centrée en bas produisait un amas serré en bas
// de cadre (la vedette chevauchait presque entièrement les deux cases du
// bas). Repassé à 3 cases en diagonale (haut-gauche, haut-droite plus bas,
// milieu-gauche) + la vedette casée en bas-DROITE plutôt qu'au centre : les
// quatre zones ne se chevauchent plus, l'espacement reste aéré (retour
// répété d'Isaac sur ce hero, cf. l'historique de HERO_COLLAGE_POSITIONS
// avant sa suppression) tout en couvrant une zone nettement plus large que
// l'ancien petit carré de 256px.
const TILES = [
  { position: "absolute left-0 top-0 h-36 w-36 lg:h-40 lg:w-40", rotateDeg: -6, depth: 18 },
  { position: "absolute right-0 top-16 h-32 w-32 lg:h-36 lg:w-36", rotateDeg: 5, depth: -14 },
  { position: "absolute left-6 top-56 h-28 w-28 lg:h-32 lg:w-32", rotateDeg: 3, depth: 10 },
] as const;
const SLIDESHOW_DEPTH = -12;

export function HeroPhotoCloud({
  photos,
  slideshowProducts,
}: {
  photos: string[];
  slideshowProducts: MarketplaceCardProduct[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const el = containerRef.current;
        if (!el) return;
        // 0 quand le nuage vient d'apparaître en bas de l'écran, 1 quand il
        // a atteint le haut — fait dériver les cases pendant tout le
        // défilement du hero, pas seulement une fois à l'apparition.
        const rect = el.getBoundingClientRect();
        const viewportH = window.innerHeight || 1;
        setProgress(1 - Math.min(1, Math.max(0, rect.top / viewportH)));
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  if (photos.length === 0) return null;

  const cloudPhotos = photos.slice(0, TILES.length);

  return (
    <div
      ref={containerRef}
      className="relative hidden h-96 w-80 shrink-0 sm:block lg:h-[26rem] lg:w-[22rem]"
    >
      {cloudPhotos.map((url, i) => {
        const tile = TILES[i % TILES.length];
        return (
          <div
            key={url}
            className={tile.position}
            style={{ transform: `rotate(${tile.rotateDeg}deg) translateY(${progress * tile.depth}px)` }}
            aria-hidden="true"
          >
            <ProductImage
              src={url}
              alt=""
              className="h-full w-full rounded-xl object-cover shadow-[0_18px_36px_rgba(14,59,44,0.16)]"
            />
          </div>
        );
      })}

      {/* Case avant, en bas à droite : la même vedette rotative de
          meilleures ventes qu'avant (voir hero-featured-slideshow.tsx) —
          seule case cliquable du nuage, `aria-hidden` retiré ici uniquement.
          Casée à droite plutôt qu'au centre pour ne pas empiéter sur la
          case du milieu-gauche juste au-dessus. */}
      <div
        className="absolute bottom-0 right-4 z-20 h-40 w-40 lg:h-44 lg:w-44"
        style={{ transform: `translateY(${progress * SLIDESHOW_DEPTH}px) rotate(2deg)` }}
        aria-hidden={false}
      >
        <HeroFeaturedSlideshow products={slideshowProducts} className="h-full w-full" />
      </div>
    </div>
  );
}
