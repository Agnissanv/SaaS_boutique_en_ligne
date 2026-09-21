"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ProductImage } from "@/components/product-image";

type ProductSuggestion = {
  id: string;
  slug: string;
  shopSlug: string;
  title: string;
  price: number;
  thumbnail?: string;
};

type ShopSuggestion = { slug: string; name: string };

/**
 * Barre de recherche marketplace avec autocomplete — extraite de l'en-tête
 * de la page d'accueil le 21/09/2026 (client component nécessaire pour la
 * liste de suggestions, contrairement au `<form>` GET simple d'avant).
 *
 * Reste un vrai `<form method="GET" action="/">` par-dessous (progressive
 * enhancement) : sans JavaScript, ou en cas d'échec du fetch, la recherche
 * "Entrée"/"Rechercher" classique fonctionne exactement comme avant — les
 * suggestions ne sont qu'une couche en plus, jamais un remplacement du
 * comportement existant.
 *
 * Une suggestion boutique renvoie directement vers la boutique, une
 * suggestion produit directement vers la fiche produit — l'autocomplete
 * saute l'étape "page de résultats" quand l'intention est déjà claire.
 */
export function MarketplaceSearch({
  defaultValue,
  categorie,
}: {
  defaultValue: string;
  categorie?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [products, setProducts] = useState<ProductSuggestion[]>([]);
  const [shops, setShops] = useState<ShopSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2) {
      // Pas de setState synchrone ici (règle react-hooks/set-state-in-effect) :
      // on saute simplement la requête. D'éventuelles anciennes suggestions
      // restent en mémoire mais ne s'affichent jamais, grâce à la condition
      // `queryLongEnough` au rendu plus bas.
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      fetch(`/api/marketplace/search-suggestions?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { products?: ProductSuggestion[]; shops?: ShopSuggestion[] } | null) => {
          if (!data) return;
          setProducts(data.products ?? []);
          setShops(data.shops ?? []);
          setOpen(true);
        })
        .catch(() => {
          // Requête annulée (nouvelle frappe) ou réseau indisponible — la
          // recherche classique au submit reste fonctionnelle dans tous les
          // cas, ce n'est qu'un enrichissement.
        });
    }, 250);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const queryLongEnough = value.trim().length >= 2;
  const hasSuggestions = queryLongEnough && (products.length > 0 || shops.length > 0);

  return (
    <div
      ref={containerRef}
      className="relative order-3 flex w-full sm:order-2 sm:w-auto sm:flex-1"
    >
      <form
        method="GET"
        action="/"
        className="flex w-full gap-2"
        onSubmit={() => setOpen(false)}
      >
        {categorie ? <input type="hidden" name="categorie" value={categorie} /> : null}
        <input
          type="text"
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => hasSuggestions && setOpen(true)}
          autoComplete="off"
          placeholder="Rechercher un article..."
          className="w-full rounded-md border border-transparent bg-white px-3 py-2 text-sm text-encre placeholder:text-encre/50 focus:outline-none focus:ring-2 focus:ring-cuivre-clair"
        />
        <button
          type="submit"
          className="shrink-0 rounded-md bg-cuivre-profond px-4 py-2 text-sm font-medium text-ivoire hover:bg-cuivre"
        >
          Rechercher
        </button>
      </form>

      {open && hasSuggestions ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-96 overflow-y-auto rounded-md border border-ligne bg-white text-encre shadow-lg">
          {shops.length > 0 ? (
            <div className="border-b border-ligne p-1">
              {shops.map((shop) => (
                <Link
                  key={shop.slug}
                  href={`/${shop.slug}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-brume"
                >
                  <span className="shrink-0 text-xs text-encre/50">Boutique</span>
                  <span className="line-clamp-1 font-medium">{shop.name}</span>
                </Link>
              ))}
            </div>
          ) : null}
          {products.length > 0 ? (
            <div className="p-1">
              {products.map((product) => (
                <Link
                  key={product.id}
                  href={`/${product.shopSlug}/${product.slug}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-brume"
                >
                  <ProductImage
                    src={product.thumbnail}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded object-cover"
                  />
                  <span className="line-clamp-1 flex-1">{product.title}</span>
                  <span className="shrink-0 font-mono text-xs text-cuivre-profond">
                    {product.price.toLocaleString("fr-FR")} FCFA
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
