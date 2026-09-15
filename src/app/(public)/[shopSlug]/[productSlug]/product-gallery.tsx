"use client";

import { useEffect, useState } from "react";

type Image = { url: string };

/**
 * Galerie photo (image principale + miniatures cliquables), à la place du
 * scroll horizontal de miniatures toutes identiques d'avant — demandé par
 * Isaac le 13/09/2026 ("fonctionnalités essentielles" de la fiche produit,
 * inspiré des standards concurrents type Jumia).
 *
 * Zoom plein écran ajouté le même jour : Isaac a remarqué qu'une image
 * recadrée (`object-cover`) ne montre pas toujours le produit en entier.
 * Un tap sur l'image principale ouvre donc une vue plein écran en
 * `object-contain` (l'image entière est visible, quitte à laisser des
 * bandes vides), avec navigation entre les photos si plusieurs existent —
 * comme sur les galeries des concurrents (Jumia, etc.).
 *
 * Recoloré le 15/09/2026 avec la charte KEVA (voir la refonte de la fiche
 * produit publique dans decisions-techniques.md) : format carré cohérent
 * avec le reste des vignettes produit du site, fond de repli Brume plutôt
 * que gris, superposition du zoom en Vert Profond (quasi noir, sur charte)
 * plutôt qu'un noir neutre. Comportement inchangé.
 */
export function ProductGallery({ images, title }: { images: Image[]; title: string }) {
  const [selected, setSelected] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const activeIndex = images.length > 0 ? Math.min(selected, images.length - 1) : 0;

  // Ferme au clavier (Échap) et bloque le scroll de la page pendant le zoom.
  useEffect(() => {
    if (!lightboxOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowRight") setSelected((i) => (i + 1) % images.length);
      if (e.key === "ArrowLeft") setSelected((i) => (i - 1 + images.length) % images.length);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [lightboxOpen, images.length]);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-brume text-sm text-encre/40">
        Pas de photo
      </div>
    );
  }

  function showPrevious(e: React.MouseEvent) {
    e.stopPropagation();
    setSelected((i) => (i - 1 + images.length) % images.length);
  }

  function showNext(e: React.MouseEvent) {
    e.stopPropagation();
    setSelected((i) => (i + 1) % images.length);
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setLightboxOpen(true)}
        className="block w-full cursor-zoom-in overflow-hidden rounded-xl border border-ligne"
        aria-label="Agrandir la photo"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- images uploadées par le vendeur, source dynamique */}
        <img
          src={images[activeIndex].url}
          alt={title}
          className="aspect-square w-full object-cover"
        />
      </button>
      {images.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {images.map((img, index) => (
            <button
              key={img.url}
              type="button"
              onClick={() => setSelected(index)}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 ${
                index === activeIndex ? "border-cuivre-profond" : "border-ligne"
              }`}
              aria-label={`Voir la photo ${index + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- idem */}
              <img src={img.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-vert-profond/95 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-ivoire/10 text-xl text-ivoire"
            aria-label="Fermer"
          >
            ×
          </button>

          {/* object-contain plutôt que object-cover : l'image entière reste
              visible ici, même si elle est recadrée dans la galerie normale. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- idem */}
          <img
            src={images[activeIndex].url}
            alt={title}
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={showPrevious}
                className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-ivoire/10 text-2xl text-ivoire"
                aria-label="Photo précédente"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={showNext}
                className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-ivoire/10 text-2xl text-ivoire"
                aria-label="Photo suivante"
              >
                ›
              </button>
              <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-ivoire/80">
                {activeIndex + 1} / {images.length}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
