"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductImage } from "@/components/product-image";
import type { MarketplaceCardProduct } from "@/components/product-card";

const ROTATE_MS = 3500;

/**
 * Case avant du collage du hero desktop — ajoutée le 22/09/2026, à la
 * demande d'Isaac de s'inspirer d'un hero avec carrousel ("j'ai vu un
 * carrousel... essayer de trouver un truc [...] l'objectif c'est de faire un
 * truc qui se vend bien, pas un contenu générique IA"). Plutôt qu'un
 * indicateur de slides décoratif sur une image statique (comme la
 * référence), cette case fait tourner de vraies meilleures ventes,
 * cliquables — même données que `HeroMobileSlideshow` (`heroSlideshowProducts`,
 * page.tsx), aucune requête supplémentaire. Les deux autres cases du collage
 * restent des vignettes statiques (nouveautés) : seule celle-ci, la plus au
 * premier plan, tourne — reste lisible plutôt que trois photos qui
 * changent en même temps.
 *
 * Même règle `prefers-reduced-motion` que `HeroMobileSlideshow` : pas de
 * rotation automatique si l'utilisateur a demandé de réduire les animations.
 */
export function HeroFeaturedSlideshow({
  products,
  className,
}: {
  products: MarketplaceCardProduct[];
  className?: string;
}) {
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
      className={`group relative block overflow-hidden rounded-xl ${className ?? ""}`}
    >
      <ProductImage
        src={current.thumbnail}
        alt={current.title}
        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-vert-profond/85 to-transparent px-3 pb-2.5 pt-8">
        <p className="line-clamp-1 text-xs font-medium text-ivoire">{current.title}</p>
        <p className="font-mono text-xs font-semibold text-ivoire/90">
          {current.price.toLocaleString("fr-FR")} FCFA
        </p>
      </div>
      {products.length > 1 ? (
        <div className="absolute right-2 top-2 flex gap-1" aria-hidden="true">
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
