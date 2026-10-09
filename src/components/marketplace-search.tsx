"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ProductImage } from "@/components/product-image";
import { InstantSearchForm } from "@/components/instant-search-form";

type ProductSuggestion = {
  id: string;
  slug: string;
  shopSlug: string;
  title: string;
  price: number;
  thumbnail?: string;
};

type ShopSuggestion = { slug: string; name: string };

type CategorySuggestion = { value: string; label: string };

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
 *
 * 09/10/2026 : l'envoi ne recharge plus la page (voir `InstantSearchForm`),
 * et les suggestions viennent du même moteur que la page de résultats
 * (rayons proposés en plus : « ordinateur » -> Informatique).
 *
 * `prixMin`/`prixMax`/`attrs` ajoutés en champs cachés le 22/09/2026
 * (chantier "filtres") : sans ça, lancer une nouvelle recherche texte
 * effaçait silencieusement tout filtre de prix/attribut déjà actif — même
 * principe que les champs cachés `categorie` existants.
 */
export function MarketplaceSearch({
  defaultValue,
  categorie,
  prixMin,
  prixMax,
  attrs,
  variant = "header",
}: {
  defaultValue: string;
  categorie?: string;
  prixMin?: string;
  prixMax?: string;
  attrs?: Record<string, string[]>;
  /** "hero" : grande pastille du hero (09/10/2026) ; "header" : barre de l'en-tête. */
  variant?: "header" | "hero";
}) {
  const isHero = variant === "hero";
  const [value, setValue] = useState(defaultValue);
  // La recherche change sans recharger la page : on resynchronise le champ
  // quand la requête de l'URL change (ex. la barre de l'en-tête après une
  // recherche lancée depuis le hero).
  const [syncedDefault, setSyncedDefault] = useState(defaultValue);
  if (defaultValue !== syncedDefault) {
    setSyncedDefault(defaultValue);
    setValue(defaultValue);
  }
  const [products, setProducts] = useState<ProductSuggestion[]>([]);
  const [shops, setShops] = useState<ShopSuggestion[]>([]);
  const [categories, setCategories] = useState<CategorySuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // Requête qui vient d'être envoyée : ses suggestions, si elles arrivent
  // après l'envoi, ne doivent pas rouvrir la liste par-dessus les résultats.
  const submittedQuery = useRef<string | null>(null);

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
        .then(
          (
            data: {
              products?: ProductSuggestion[];
              shops?: ShopSuggestion[];
              categories?: CategorySuggestion[];
            } | null
          ) => {
          if (!data) return;
          setProducts(data.products ?? []);
          setShops(data.shops ?? []);
          setCategories(data.categories ?? []);
          if (submittedQuery.current !== query) setOpen(true);
          }
        )
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
  const hasSuggestions =
    queryLongEnough && (products.length > 0 || shops.length > 0 || categories.length > 0);

  return (
    <div
      ref={containerRef}
      className={
        isHero ? "relative flex w-full" : "relative order-3 flex w-full sm:order-2 sm:w-auto sm:flex-1"
      }
    >
      <InstantSearchForm
        action="/"
        scrollTargetId="catalogue"
        onSubmitted={() => {
          submittedQuery.current = value.trim();
          setOpen(false);
        }}
        className={
          isHero
            ? "group/search flex w-full items-center gap-1 rounded-full bg-white p-1.5 shadow-[0_8px_24px_rgba(14,59,44,0.12)] ring-1 ring-ligne focus-within:ring-2 focus-within:ring-vert-actif"
            : "group/search flex w-full gap-2"
        }
      >
        {categorie ? <input type="hidden" name="categorie" value={categorie} /> : null}
        {prixMin ? <input type="hidden" name="prix_min" value={prixMin} /> : null}
        {prixMax ? <input type="hidden" name="prix_max" value={prixMax} /> : null}
        {attrs
          ? Object.entries(attrs).flatMap(([key, values]) =>
              values.map((value) => (
                <input key={`${key}:${value}`} type="hidden" name={`attr_${key}`} value={value} />
              ))
            )
          : null}
        <input
          type="text"
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => hasSuggestions && setOpen(true)}
          autoComplete="off"
          placeholder={isHero ? "Rechercher un produit, une boutique ou une catégorie..." : "Rechercher un article..."}
          className={
            isHero
              ? "w-full rounded-full bg-transparent px-4 py-2.5 text-sm text-encre placeholder:text-encre/50 focus:outline-none"
              : "w-full rounded-md border border-transparent bg-white px-3 py-2 text-sm text-encre placeholder:text-encre/50 focus:outline-none focus:ring-2 focus:ring-vert-actif"
          }
        />
        <button
          type="submit"
          className={
            isHero
              ? "relative shrink-0 rounded-full bg-vert-actif px-6 py-2.5 text-sm font-semibold text-white hover:bg-vert-sapin"
              : "relative shrink-0 rounded-md bg-vert-actif px-4 py-2 text-sm font-medium text-ivoire hover:bg-vert-sapin"
          }
        >
          <span className="group-data-[pending]/search:invisible">Rechercher</span>
          <span
            aria-hidden="true"
            className="absolute inset-0 hidden items-center justify-center group-data-[pending]/search:flex"
          >
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
          </span>
        </button>
      </InstantSearchForm>

      {open && hasSuggestions ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-96 overflow-y-auto rounded-md border border-ligne bg-white text-encre shadow-lg">
          {categories.length > 0 ? (
            <div className="border-b border-ligne p-1">
              {categories.map((category) => (
                <Link
                  key={category.value}
                  href={`/?categorie=${encodeURIComponent(category.value)}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-brume"
                >
                  <span className="shrink-0 text-xs text-encre/50">Rayon</span>
                  <span className="line-clamp-1 font-medium">{category.label}</span>
                </Link>
              ))}
            </div>
          ) : null}
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
                  <span className="shrink-0 font-mono text-xs text-vert-actif">
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
