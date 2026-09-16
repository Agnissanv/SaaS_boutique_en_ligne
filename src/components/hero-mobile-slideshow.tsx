"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductImage } from "@/components/product-image";
import type { MarketplaceCardProduct } from "@/components/product-card";

const ROTATE_MS = 3500;

/**
 * Diaporama mobile du hero — ajouté le 16/09/2026 (retour d'Isaac, en
 * comparant KEVA à la concurrence : "sur mobile on remplace les chiffres de
 * nombre de boutique par un diaporama aléatoire des produits les plus
 * vendus ou de n'importe quel produit de la boutique"). Remplace, sur
 * mobile uniquement, les chiffres "Boutiques actives"/"Produits en vente"
 * du hero (voir page.tsx) : ces chiffres restent affichés tels quels sur
 * desktop (`sm:hidden` sur ce composant), où le collage de photos occupe
 * déjà la colonne de droite.
 *
 * L'ordre "aléatoire" est déjà tiré côté serveur (voir `shuffle()` dans
 * page.tsx, un nouveau tirage à chaque chargement de page) — ce composant
 * ne fait qu'avancer dans la liste reçue, jamais de second mélange côté
 * client (qui désynchroniserait l'ordre entre le rendu serveur et
 * l'hydratation).
 *
 * `prefers-reduced-motion` : pas de rotation automatique si l'utilisateur a
 * demandé de réduire les animations côté système — la première photo reste
 * affichée, jamais un diaporama qui tourne malgré la préférence.
 */
export function HeroMobileSlideshow({ products }: { products: MarketplaceCardProduct[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (products.length <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % products.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [products.length]);

  if (products.length === 0) return null;

  const current = products[index];

  return (
    <Link
      href={`/${current.shopSlug}/${current.slug}`}
      className="relative mt-9 block h-40 w-full overflow-hidden rounded-xl sm:hidden"
    >
      <ProductImage src={current.thumbnail} alt={current.title} className="h-full w-full object-cover" />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2.5 pt-6">
        <p className="line-clamp-1 text-sm font-medium text-ivoire">{current.title}</p>
        <p className="font-mono text-xs text-ivoire/80">{current.price} FCFA</p>
      </div>
      {products.length > 1 ? (
        <div className="absolute right-2.5 top-2.5 flex gap-1" aria-hidden="true">
          {products.map((p, i) => (
            <span
              key={p.id}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                i === index ? "bg-ivoire" : "bg-ivoire/40"
              }`}
            />
          ))}
        </div>
      ) : null}
    </Link>
  );
}
