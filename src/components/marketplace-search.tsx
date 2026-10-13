"use client";

import { fcfa } from "@/lib/utils/money";

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

// Recherches récentes (13/10/2026, lot 2 UX) : gardées dans ce navigateur
// seulement, jamais envoyées au serveur.
const RECENT_SEARCHES_KEY = "keva_recherches_recentes";
const RECENT_SEARCHES_MAX = 5;

function readRecentSearches(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string").slice(0, RECENT_SEARCHES_MAX) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string): string[] {
  const next = [query, ...readRecentSearches().filter((v) => v.toLowerCase() !== query.toLowerCase())].slice(
    0,
    RECENT_SEARCHES_MAX
  );
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  } catch {
    // Stockage indisponible (navigation privée) : rien de grave.
  }
  return next;
}

function clearRecentSearches() {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // Idem.
  }
}

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
  shortcuts = [],
}: {
  defaultValue: string;
  categorie?: string;
  prixMin?: string;
  prixMax?: string;
  attrs?: Record<string, string[]>;
  /** Rayons proposés quand on touche la barre sans rien taper. */
  shortcuts?: { label: string; href: string }[];
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
          // Jamais pour la recherche déjà affichée (page de résultats chargée
          // avec « ordinateur » dans le champ) : la liste s'ouvrait toute
          // seule par-dessus les résultats (audit visuel du 13/10/2026).
          if (submittedQuery.current !== query && query !== defaultValue.trim()) setOpen(true);
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
  }, [value, defaultValue]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [recent, setRecent] = useState<string[]>([]);
  const queryLongEnough = value.trim().length >= 2;
  // Barre touchée sans rien taper : recherches récentes et rayons populaires.
  const showStarters = !queryLongEnough && (recent.length > 0 || shortcuts.length > 0);
  const hasSuggestions =
    queryLongEnough && (products.length > 0 || shops.length > 0 || categories.length > 0);

  return (
    <div
      ref={containerRef}
      className={
        isHero ? "relative flex w-full" : "relative flex min-w-0 flex-1 sm:order-2"
      }
    >
      <InstantSearchForm
        action="/"
        scrollTargetId="catalogue"
        onSubmitted={() => {
          submittedQuery.current = value.trim();
          if (value.trim()) setRecent(saveRecentSearch(value.trim()));
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
          aria-label="Rechercher sur KEVA"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => {
            setRecent(readRecentSearches());
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          autoComplete="off"
          placeholder={isHero ? "Rechercher un produit ou une boutique…" : "Rechercher un article…"}
          className={
            isHero
              ? "w-full rounded-full bg-transparent px-4 py-2.5 text-sm text-encre placeholder:text-encre/50 focus:outline-none"
              : "w-full rounded-md border border-ligne bg-white px-3 py-2 text-sm text-encre placeholder:text-encre/50 focus:outline-none focus:ring-2 focus:ring-vert-actif"
          }
        />
        <button
          type="submit"
          className={
            isHero
              ? "relative shrink-0 rounded-full bg-vert-actif px-6 py-2.5 text-sm font-semibold text-white hover:bg-vert-sapin"
              : "relative shrink-0 rounded-md bg-vert-actif px-3 py-2 text-sm font-medium text-ivoire hover:bg-vert-sapin sm:px-4"
          }
          aria-label="Rechercher"
        >
          {/* En-tête sur téléphone : une loupe au lieu du mot, pour tenir
              sur une seule ligne avec le logo. */}
          <span className="group-data-[pending]/search:invisible">
            {isHero ? (
              "Rechercher"
            ) : (
              <>
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  aria-hidden="true"
                  className="h-5 w-5 sm:hidden"
                >
                  <circle cx="8.5" cy="8.5" r="5.5" />
                  <path d="m16 16-3.2-3.2" />
                </svg>
                <span className="hidden sm:inline">Rechercher</span>
              </>
            )}
          </span>
          <span
            aria-hidden="true"
            className="absolute inset-0 hidden items-center justify-center group-data-[pending]/search:flex"
          >
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
          </span>
        </button>
      </InstantSearchForm>

      {open && showStarters ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-xl border border-ligne bg-white p-2 text-encre shadow-lg">
          {recent.length > 0 ? (
            <div className="pb-1">
              <div className="flex items-center justify-between px-2 py-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-encre/70">Recherches récentes</p>
                <button
                  type="button"
                  onClick={() => {
                    clearRecentSearches();
                    setRecent([]);
                  }}
                  className="text-xs font-medium text-vert-actif transition-colors hover:text-vert-sapin"
                >
                  Effacer
                </button>
              </div>
              {recent.map((term) => (
                <Link
                  key={term}
                  href={`/?q=${encodeURIComponent(term)}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-brume"
                >
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" className="h-4 w-4 shrink-0 text-encre/60" aria-hidden="true">
                    <circle cx="10" cy="10" r="7" />
                    <path d="M10 6.5V10l2.5 1.5" />
                  </svg>
                  <span className="truncate">{term}</span>
                </Link>
              ))}
            </div>
          ) : null}
          {shortcuts.length > 0 ? (
            <div className={recent.length > 0 ? "border-t border-ligne pt-2" : ""}>
              <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-encre/70">Rayons populaires</p>
              <div className="flex flex-wrap gap-1.5 px-2 pb-1 pt-1">
                {shortcuts.slice(0, 6).map((shortcut) => (
                  <Link
                    key={shortcut.href}
                    href={shortcut.href}
                    onClick={() => setOpen(false)}
                    className="rounded-full bg-brume px-3 py-1.5 text-xs font-medium text-encre transition hover:bg-vert-actif hover:text-ivoire"
                  >
                    {shortcut.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

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
                  <span className="shrink-0 text-xs text-encre/70">Rayon</span>
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
                  <span className="shrink-0 text-xs text-encre/70">Boutique</span>
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
                  <span className="shrink-0 font-display font-bold tabular-nums text-xs text-vert-actif">
                    {fcfa(product.price)}
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
