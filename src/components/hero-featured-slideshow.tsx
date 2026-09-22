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
 * Retravaillée le 22/09/2026 (v2, hero encadré + mockup validé) : la légende
 * en dégradé sur la photo devient une vraie carte prix flottante, qui déborde
 * volontairement du cadre de la photo — nod direct à la référence d'Isaac
 * (badge produit flottant), avec un vrai produit plutôt qu'un placeholder.
 * D'où le `overflow-hidden` déplacé de <Link> vers un wrapper interne autour
 * de la seule photo : la carte, elle, doit pouvoir déborder. `-rotate-2`
 * contrebalance le tilt `rotate-2` posé par le parent (page.tsx) pour que la
 * carte reste droite pendant que la photo, elle, garde son angle.
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
      className={`group relative block ${className ?? ""}`}
    >
      <div className="h-full w-full overflow-hidden rounded-xl">
        <ProductImage
          src={current.thumbnail}
          alt={current.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
        />
      </div>

      {products.length > 1 ? (
        // Fond translucide sombre derrière les points : sans le dégradé qui
        // couvrait toute la photo auparavant, rien ne garantit plus que la
        // photo elle-même soit assez sombre pour que des points blancs
        // restent lisibles.
        <div
          className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-vert-profond/40 px-1.5 py-1"
          aria-hidden="true"
        >
          {products.map((p, i) => (
            <span
              key={p.id}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                i === index ? "bg-white" : "bg-white/40"
              }`}
            />
          ))}
        </div>
      ) : null}

      <div className="absolute -bottom-3 -left-2 max-w-[80%] -rotate-2 rounded-xl bg-white px-3 py-2 shadow-[0_14px_30px_rgba(14,59,44,0.22)]">
        <p className="line-clamp-1 text-[11px] text-encre/60">{current.title}</p>
        <p className="font-mono text-sm font-semibold text-vert-actif">
          {current.price.toLocaleString("fr-FR")} FCFA
        </p>
      </div>
    </Link>
  );
}
