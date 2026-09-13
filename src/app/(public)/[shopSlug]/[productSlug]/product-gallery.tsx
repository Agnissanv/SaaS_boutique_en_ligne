"use client";

import { useState } from "react";

type Image = { url: string };

/**
 * Galerie photo (image principale + miniatures cliquables), à la place du
 * scroll horizontal de miniatures toutes identiques d'avant — demandé par
 * Isaac le 13/09/2026 ("fonctionnalités essentielles" de la fiche produit,
 * inspiré des standards concurrents type Jumia).
 */
export function ProductGallery({ images, title }: { images: Image[]; title: string }) {
  const [selected, setSelected] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex h-72 w-full items-center justify-center rounded-md bg-gray-100 text-sm text-gray-400">
        Pas de photo
      </div>
    );
  }

  const activeIndex = Math.min(selected, images.length - 1);

  return (
    <div>
      {/* eslint-disable-next-line @next/next/no-img-element -- images uploadées par le vendeur, source dynamique */}
      <img
        src={images[activeIndex].url}
        alt={title}
        className="h-72 w-full rounded-md object-cover"
      />
      {images.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {images.map((img, index) => (
            <button
              key={img.url}
              type="button"
              onClick={() => setSelected(index)}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded border-2 ${
                index === activeIndex ? "border-gray-900" : "border-transparent"
              }`}
              aria-label={`Voir la photo ${index + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- idem */}
              <img src={img.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
