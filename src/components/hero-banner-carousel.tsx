"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const ROTATE_MS = 6000;

/**
 * Fond du hero (09/10/2026, modèle fourni par Isaac dans `public/hero/model.jpeg`) :
 * carrousel des visuels `public/hero/*.jpeg` — fond vert, moitié gauche vide
 * (réservée au texte du hero), produits à droite. Sur desktop le carrousel
 * occupe tout le hero derrière le texte ; sur mobile (09/10/2026, version
 * "image d'abord") il est en haut de l'écran, sous la barre transparente, avec
 * le texte dans une feuille blanche qui le chevauche ; on le fait glisser au
 * doigt (flèches masquées).
 *
 * Les visuels sont décoratifs (`alt=""`, `aria-hidden`) : le texte du hero, lui,
 * reste du vrai HTML. Seuls le visuel actif, le suivant et le précédent sont montés —
 * pas les 7 d'un coup. Rotation automatique en pause au survol, désactivée sous
 * `prefers-reduced-motion`, comme les autres animations du site.
 */
export function HeroBannerCarousel({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = (target: number) => setIndex((target + images.length) % images.length);

  // Glissement au doigt (mobile) : un déplacement horizontal d'au moins 40 px,
  // plus horizontal que vertical, change de visuel — sans gêner le défilement
  // vertical de la page.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setPaused(true);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    setPaused(false);
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(index + (dx < 0 ? 1 : -1));
  };

  useEffect(() => {
    if (images.length <= 1 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % images.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [images.length, paused]);

  const nextIndex = (index + 1) % images.length;
  const prevIndex = (index - 1 + images.length) % images.length;

  return (
    <div
      className="relative order-1 h-80 sm:order-2 sm:absolute sm:inset-0 sm:h-auto"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Sur desktop, les visuels sont décalés de 14 % vers la droite et fondus
          sur leur bord gauche : sur certains, des produits démarrent à ~37 %
          de la largeur et passeraient sous la recherche et les pastilles. */}
      <div
        className="absolute inset-0 overflow-hidden sm:left-[14%] sm:[mask-image:linear-gradient(to_right,transparent,#000_16%)]"
        aria-hidden="true"
      >
        {images.map((src, i) =>
          i === index || i === nextIndex || i === prevIndex ? (
            <Image
              key={src}
              src={src}
              alt=""
              fill
              priority={i === 0}
              sizes="100vw"
              className={`object-cover object-right transition-opacity duration-700 ${
                i === index ? "opacity-100" : "opacity-0"
              }`}
            />
          ) : null
        )}
      </div>

      {images.length > 1 ? (
        <div className="absolute bottom-9 right-3 z-20 flex items-center gap-2 sm:bottom-5 sm:right-6">
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Visuel précédent"
            className="hidden h-8 w-8 sm:flex items-center justify-center rounded-full bg-white/90 text-vert-sapin shadow-sm transition hover:bg-white"
          >
            <Chevron direction="left" />
          </button>
          <div className="flex items-center gap-1.5 rounded-full bg-white/85 px-2.5 py-2 shadow-sm">
            {images.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => go(i)}
                aria-label={`Aller au visuel ${i + 1}`}
                aria-current={i === index}
                className={`h-2 rounded-full transition-all ${
                  i === index ? "w-5 bg-vert-actif" : "w-2 bg-vert-sapin/30 hover:bg-vert-sapin/50"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Visuel suivant"
            className="hidden h-8 w-8 sm:flex items-center justify-center rounded-full bg-white/90 text-vert-sapin shadow-sm transition hover:bg-white"
          >
            <Chevron direction="right" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
      <path d={direction === "left" ? "M12 4l-6 6 6 6" : "M8 4l6 6-6 6"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
