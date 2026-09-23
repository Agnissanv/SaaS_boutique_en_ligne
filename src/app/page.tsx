import Link from "next/link";
import { ViewTransition } from "react";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import { SortSelect } from "@/components/sort-select";
import { CategoryNav } from "@/components/category-nav";
import { ProductCard, type MarketplaceCardProduct } from "@/components/product-card";
import { ProductRow } from "@/components/product-row";
import { ShopCard, type MarketplaceShop } from "@/components/shop-card";
import { ProductImage } from "@/components/product-image";
import { HeroMobileSlideshow } from "@/components/hero-mobile-slideshow";
import { HeroFeaturedSlideshow } from "@/components/hero-featured-slideshow";
import { MarketplaceSearch } from "@/components/marketplace-search";
import { RecentlyViewedRow } from "@/components/recently-viewed-row";
import {
  buildMarketplaceHref,
  parseAttrsFromSearchParams,
  firstParam,
  type MarketplaceFilters,
} from "@/lib/marketplace/filters";
import { computeAttributeFacets } from "@/lib/marketplace/attribute-facets";
import { getCategoryAttributeFields } from "@/lib/category-attributes";
import { ProductFilterPanel } from "@/components/product-filter-panel";
import { getShopRating } from "@/lib/reviews";
import { getEffectivePrice } from "@/lib/products";
import { boostByPlanWithinDay } from "@/lib/marketplace/ranking";

// Marketplace publique : découverte multi-boutiques (cf. demande d'Isaac du
// 13/09/2026 — équivalent d'un "atterrissage" façon Jumia, en complément du
// lien direct `/[shopSlug]` que chaque vendeur partage sur WhatsApp/Instagram).
// Le cahier des charges classe la "marketplace globale (recherche
// multi-boutiques)" en Priorité 3 (roadmap long terme) ; construite ici par
// anticipation, à la demande explicite d'Isaac plutôt que dans l'ordre du
// cahier des charges — voir decisions-techniques.md.
//
// Round 2 de refonte le 15/09/2026 : le premier passage du jour (hero, chiffres
// réels, icônes de confiance) a été jugé encore trop pauvre par Isaac
// ("je veux une vraie page de marketplace... comme Jumia, Amazon") — deux
// changements structurels demandés explicitement :
// 1. Remplacer l'unique grille "Tout le catalogue" paginée par une bande à
//    défilement horizontal PAR CATÉGORIE (même traitement que "Nouveautés"),
//    pour ne jamais afficher des centaines/milliers d'articles d'un coup —
//    la grille paginée reste utilisée, mais seulement en mode filtré
//    (recherche ou catégorie choisie explicitement).
// 2. Étendre `CATEGORIES` (6 → 24, voir `src/lib/categories.ts`) : une
//    marketplace de cette ambition a besoin de bien plus de catégories que
//    "Mode, Beauté, Électronique, Maison, Alimentation, Autre".
// Ajout non demandé explicitement mais dans l'esprit de la demande ("ça
// dépend de toi") : une bande "Meilleures ventes", agrégée sur de vraies
// commandes (`get_best_selling_products`, migration 0015) — jamais un
// classement inventé.

const PAGE_SIZE = 24;
const NEW_ARRIVALS_SIZE = 10;
const FEATURED_SHOPS_SIZE = 10;
const BEST_SELLERS_SIZE = 12;
const CATEGORY_ROW_SIZE = 12;
// Nombre de produits actifs les plus récents considérés pour regrouper les
// bandes par catégorie — une seule requête groupée en JS plutôt que jusqu'à
// 24 requêtes (une par catégorie). Compromis délibéré, documenté dans
// decisions-techniques.md. Un produit plus ancien que cette fenêtre reste
// consultable via "Voir tout" (grille filtrée par catégorie, non plafonnée)
// et via la recherche — seule la bande d'aperçu peut le manquer.
const CATEGORY_FEED_LIMIT = 400;
const HERO_COLLAGE_SIZE = 3;
// Échantillon borné pour le calcul des facettes de filtre (valeurs
// d'attribut réellement présentes + bornes de prix) — même pragmatisme et
// même ordre de grandeur que `CATEGORY_FEED_LIMIT` ci-dessus : un compromis
// documenté plutôt qu'une agrégation SQL dédiée, à revoir si le catalogue
// grossit significativement (voir `computeAttributeFacets`).
const FACET_SAMPLE_LIMIT = 400;

const SORTS = [
  { value: "recent", label: "Plus récent" },
  { value: "prix_asc", label: "Prix croissant" },
  { value: "prix_desc", label: "Prix décroissant" },
] as const;
type SortValue = (typeof SORTS)[number]["value"];

// Positionnement du collage de photos produit dans le hero — un motif de
// piles de photos légèrement pivotées, jamais plus de 3 pour rester lisible.
// Rendu seulement si la marketplace a au moins une photo de produit récente
// (voir plus bas) : jamais de case vide à la place, le rectangle placeholder
// d'avant est simplement retiré si le catalogue est encore vide.
//
// Recoloré le 22/09/2026 (passage du hero en fond blanc, voir en-tête du
// fichier "Fond blanc + vert" dans decisions-techniques.md) : la bordure
// ivoire/15 servait à détacher les photos du fond vert foncé d'avant — sur
// fond blanc elle disparaîtrait, remplacée par une ombre portée teintée
// vert plutôt qu'un simple `shadow-xl` neutre, pour rester dans la charte.
// Les deux premières cases restent des vignettes statiques (nouveautés) ;
// la troisième (la plus au premier plan) est désormais le carrousel de
// meilleures ventes (`HeroFeaturedSlideshow`, voir plus bas).
//
// Agrandi le 22/09/2026 (retour d'Isaac : "je trouve que se carrousel est un
// peu trop petit... mais ne le rend pas envahissant, le site doit être
// aéré") — augmentation modérée (~15%) plutôt qu'un doublement, et un cran
// de plus sur grand écran (`lg:`, hero desktop large) où l'espace libre du
// cadre du hero le permet sans tasser le texte à côté.
const HERO_COLLAGE_POSITIONS = [
  "absolute left-0 top-6 h-36 w-36 -rotate-6 shadow-[0_18px_36px_rgba(14,59,44,0.16)] lg:h-40 lg:w-40",
  "absolute right-2 top-0 z-10 h-32 w-32 rotate-3 shadow-[0_18px_36px_rgba(14,59,44,0.16)] lg:h-36 lg:w-36",
  "absolute bottom-0 left-16 z-20 h-32 w-32 rotate-2 shadow-[0_18px_36px_rgba(14,59,44,0.16)] lg:h-36 lg:w-36",
];

// Icônes de l'argumentaire de confiance — dessinées à la main en SVG inline,
// même parti pris que les icônes de la sidebar du dashboard vendeur
// (15/09/2026) : pas de dépendance à une librairie d'icônes.
function IconDelivery() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <rect x="2.5" y="6" width="10" height="8" rx="1.2" />
      <path d="M12.5 9h3l2 2.5V14h-5" />
      <circle cx="6" cy="15.5" r="1.4" />
      <circle cx="14.5" cy="15.5" r="1.4" />
    </svg>
  );
}
function IconStorefront() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <path d="M3 8.5 4 3h12l1 5.5" />
      <path d="M3 8.5a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 2 1.6V8.5" />
      <path d="M4.5 10v6.5h11V10" />
      <path d="M8.5 16.5V12.5h3v4" />
    </svg>
  );
}
function IconMobileMoney() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <rect x="5.5" y="2.5" width="9" height="15" rx="1.5" />
      <path d="M5.5 5.5h9M5.5 14.5h9" />
      <path d="M10 16.4h.01" strokeLinecap="round" />
    </svg>
  );
}

const TRUST_ITEMS = [
  {
    title: "Paiement à la livraison",
    body: "Commande sans créer de compte, paie en espèces à la réception.",
    icon: <IconDelivery />,
  },
  {
    title: "Vendeurs indépendants",
    body: "Chaque boutique est gérée par son propre vendeur, partout en Côte d'Ivoire.",
    icon: <IconStorefront />,
  },
  {
    title: "Mobile Money bientôt disponible",
    body: "Orange Money, MTN Money, Moov Money et Wave arrivent prochainement.",
    icon: <IconMobileMoney />,
  },
];

type RawMarketplaceShopEmbed = {
  slug: string;
  name: string;
  // `plan_rank`/`is_verified` — ajoutés le 22/09/2026 (migration 0042, boost
  // marketplace par palier d'abonnement + badge "Boutique vérifiée"). Voir
  // `boostByPlanWithinDay` (src/lib/marketplace/ranking.ts).
  plan_rank: number;
  is_verified: boolean;
};

type RawMarketplaceProduct = {
  id: string;
  slug: string;
  title: string;
  price: number;
  compare_at_price: number | null;
  category: string | null;
  // Nécessaire au tri "jour d'abord, palier ensuite" du boost marketplace
  // (voir ranking.ts) — pas seulement à l'affichage.
  created_at: string;
  product_images: { url: string; position: number }[];
  shop: RawMarketplaceShopEmbed | RawMarketplaceShopEmbed[] | null;
  // Prix soldé daté — ajouté le 22/09/2026 (migration 0031). Voir
  // `getEffectivePrice` (src/lib/products.ts) pour le calcul.
  sale_price: number | null;
  sale_starts_at: string | null;
  sale_ends_at: string | null;
};

// Rang de palier d'une ligne produit brute — normalise la forme `shop`
// (objet ou tableau selon le contexte de requête, même remarque que
// `toCardProduct` ci-dessous) et retombe sur le rang Starter (le plus bas)
// si jamais absent, plutôt que de planter le tri.
function planRankOf(product: RawMarketplaceProduct): number {
  const shop = Array.isArray(product.shop) ? product.shop[0] : product.shop;
  return shop?.plan_rank ?? 3;
}

// Normalise la forme `shop` renvoyée par Supabase (objet ou tableau selon le
// contexte de la requête) et calcule la vignette — utilisé par toutes les
// requêtes produit de cette page (nouveautés, meilleures ventes, bandes par
// catégorie, catalogue filtré), d'où l'extraction ici plutôt qu'une logique
// dupliquée dans chaque `.map()`. Calcule aussi le prix EFFECTIF (soldé si
// une promo datée est active maintenant, sinon le prix normal) via
// `getEffectivePrice`, plutôt que d'afficher `price`/`compare_at_price`
// bruts — même helper que le reste du site (fiche boutique, fiche produit).
function toCardProduct(product: RawMarketplaceProduct): MarketplaceCardProduct | null {
  const shop = Array.isArray(product.shop) ? product.shop[0] : product.shop;
  if (!shop) return null;
  const thumbnail = [...(product.product_images ?? [])].sort(
    (a, b) => a.position - b.position
  )[0]?.url;
  const effective = getEffectivePrice({
    price: product.price,
    compareAtPrice: product.compare_at_price,
    salePrice: product.sale_price,
    saleStartsAt: product.sale_starts_at,
    saleEndsAt: product.sale_ends_at,
  });
  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    price: effective.price,
    compareAtPrice: effective.compareAtPrice,
    isOnSale: effective.isOnSale,
    category: product.category,
    thumbnail,
    shopSlug: shop.slug,
    shopName: shop.name,
    isVerified: shop.is_verified,
  };
}

// Mélange Fisher-Yates — utilisé uniquement pour le diaporama mobile du hero
// (voir plus bas) : "aléatoire" veut dire un ordre différent à chaque
// chargement de page, pas un vrai tirage pondéré. Ne mute jamais le tableau
// reçu (copie d'abord) : les mêmes tableaux (`bestSellingProducts`,
// `newArrivalsProducts`) servent aussi, dans leur ordre d'origine, aux
// bandes "Meilleures ventes"/"Nouveautés" plus bas sur la page.
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
const HERO_SLIDESHOW_SIZE = 6;

const PRODUCT_CARD_COLUMNS =
  "id, slug, title, price, compare_at_price, category, created_at, product_images(url, position), shop:shops!inner(slug, name, status, plan_rank, is_verified), sale_price, sale_starts_at, sale_ends_at";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const q = firstParam(rawParams.q);
  const categorie = firstParam(rawParams.categorie);
  const tri = firstParam(rawParams.tri);
  const pageParam = firstParam(rawParams.page);
  const prixMin = firstParam(rawParams.prix_min);
  const prixMax = firstParam(rawParams.prix_max);
  // Filtres de spécifications par catégorie (chantier "filtres" du
  // 22/09/2026, construit sur `src/lib/category-attributes.ts`) — validés
  // contre les vraies clés de la catégorie choisie : une URL modifiée à la
  // main (ou une catégorie changée sans que les `attr_*` de l'ancienne aient
  // été nettoyés) ne doit jamais tenter de filtrer sur une clé qui n'existe
  // pas pour cette catégorie, juste l'ignorer silencieusement plutôt que de
  // laisser une requête Supabase échouer sur une colonne JSON inventée.
  const validAttrKeys = new Set(getCategoryAttributeFields(categorie).map((f) => f.key));
  const attrs = Object.fromEntries(
    Object.entries(parseAttrsFromSearchParams(rawParams)).filter(([key]) => validAttrKeys.has(key))
  );
  const sort: SortValue = SORTS.some((s) => s.value === tri) ? (tri as SortValue) : "recent";
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const current: MarketplaceFilters = { q, categorie, tri, page: pageParam, prixMin, prixMax, attrs };

  // Mode "filtré" (recherche texte, catégorie, prix ou attribut choisis
  // explicitement) : grille classique triable/paginée, comme avant. Mode par
  // défaut (aucun filtre) : disposition par bandes façon Jumia/Amazon — voir
  // le changement structurel expliqué en tête de fichier. Les deux modes
  // sont mutuellement exclusifs : jamais de grille de "tout le catalogue"
  // affichée d'un coup.
  const hasFilter = Boolean(q || categorie || prixMin || prixMax || Object.keys(attrs).length > 0);

  const supabase = await createClient();

  const newArrivalsQuery = supabase
    .from("products")
    .select(PRODUCT_CARD_COLUMNS)
    .eq("is_active", true)
    .is("deleted_at", null)
    .eq("shop.status", "active")
    .order("created_at", { ascending: false })
    .limit(NEW_ARRIVALS_SIZE);

  // Bande "Boutiques de la plateforme" : jusqu'ici la marketplace ne mettait
  // en avant que des produits, jamais les boutiques elles-mêmes (noté "non
  // fait" le 13/09/2026 à la construction initiale). Tri par nombre de vues
  // (`shops.view_count`, existant depuis le 13/09/2026) — un signal de
  // popularité simple, sans introduire de nouvelle notion. Restée visible
  // même en mode filtré (utile pour découvrir un vendeur pendant une
  // recherche), contrairement aux bandes de catalogue ci-dessous.
  const featuredShopsQuery = supabase
    .from("shops")
    .select("id, slug, name, logo_url, category, is_verified")
    .eq("status", "active")
    .order("view_count", { ascending: false })
    .limit(FEATURED_SHOPS_SIZE);

  // Chiffres réels de la plateforme, affichés dans le hero. `head: true` :
  // on ne veut que le compte, jamais les lignes elles-mêmes. Jamais une
  // valeur inventée pour "faire plein" (même principe que la barre de santé
  // du stock ou le badge "vendeur vérifié" écarté ailleurs) : si la
  // plateforme est encore petite, le chiffre réel s'affiche tel quel.
  const shopsCountQuery = supabase
    .from("shops")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  const productsCountQuery = supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .is("deleted_at", null);

  // Catégories réellement disponibles sur la marketplace (16/09/2026, retour
  // d'Isaac : la bande de catégories affichait les 24 valeurs possibles, y
  // compris celles sans aucun produit actif — un visiteur tombait sur un
  // rayon vide). Calculée à l'origine en relisant la catégorie de TOUS les
  // produits actifs de la plateforme et en dédupliquant en JS — annoncé
  // "acceptable au volume actuel, à revoir avec une RPC dédiée si le
  // catalogue grossit significativement". Remplacé le 22/09/2026 (Isaac vise
  // 1000-2000 vendeurs) par la RPC `get_available_categories`
  // (migration 0033) : le DISTINCT se fait directement en base, Postgres ne
  // renvoie qu'une poignée de lignes (une par catégorie réellement utilisée)
  // au lieu d'une par produit — ce point précis grossissait directement avec
  // le nombre de vendeurs, contrairement aux autres flux de cette page
  // (bandes par catégorie, meilleures ventes...) déjà volontairement
  // plafonnés.
  const availableCategoriesQuery = supabase.rpc("get_available_categories");

  // Grille filtrée (recherche/catégorie), seulement construite en mode
  // filtré — inutile de payer une requête paginée de tout le catalogue
  // quand la page par défaut n'en a plus besoin.
  let catalogueQuery = supabase
    .from("products")
    .select(PRODUCT_CARD_COLUMNS, { count: "exact" })
    .eq("is_active", true)
    .is("deleted_at", null)
    .eq("shop.status", "active")
    .range(from, to);
  if (q) catalogueQuery = catalogueQuery.ilike("title", `%${q}%`);
  if (categorie) catalogueQuery = catalogueQuery.eq("category", categorie);
  // Filtre de prix — sur la colonne `price` brute, pas le prix effectif
  // (soldé) calculé par `getEffectivePrice` : même approximation déjà
  // assumée par le tri prix croissant/décroissant juste en dessous, pour
  // rester cohérent entre tri et filtre plutôt que d'introduire une
  // incohérence entre les deux.
  if (prixMin) catalogueQuery = catalogueQuery.gte("price", Number(prixMin));
  if (prixMax) catalogueQuery = catalogueQuery.lte("price", Number(prixMax));
  // Filtres de spécifications (`attributes->>clé`, syntaxe JSON PostgREST
  // standard sur la colonne jsonb posée en migration 0032) — seulement
  // pertinents une fois une catégorie choisie, les clés étant propres à
  // chaque catégorie.
  if (categorie) {
    for (const [key, values] of Object.entries(attrs)) {
      catalogueQuery = catalogueQuery.in(`attributes->>${key}`, values);
    }
  }
  if (sort === "prix_asc") catalogueQuery = catalogueQuery.order("price", { ascending: true });
  else if (sort === "prix_desc") catalogueQuery = catalogueQuery.order("price", { ascending: false });
  else catalogueQuery = catalogueQuery.order("created_at", { ascending: false });

  // Échantillon borné pour les facettes de filtre (valeurs d'attribut
  // dispo + bornes de prix) — même périmètre recherche/catégorie que la
  // grille, mais JAMAIS recroisé avec les filtres de prix/attribut déjà
  // sélectionnés (voir `computeAttributeFacets`) : sinon cocher une valeur
  // ferait immédiatement disparaître les autres options de la même liste.
  let facetRowsQuery = supabase
    .from("products")
    .select("price, attributes, shop:shops!inner(status)")
    .eq("is_active", true)
    .is("deleted_at", null)
    .eq("shop.status", "active")
    .limit(FACET_SAMPLE_LIMIT);
  if (q) facetRowsQuery = facetRowsQuery.ilike("title", `%${q}%`);
  if (categorie) facetRowsQuery = facetRowsQuery.eq("category", categorie);

  // Flux borné de produits récents, regroupé en JS par catégorie plus bas —
  // une seule requête plutôt que jusqu'à 24 (une par catégorie). Seulement
  // nécessaire en mode par défaut (pas de bandes par catégorie en mode
  // filtré).
  const categoryFeedQuery = supabase
    .from("products")
    .select(PRODUCT_CARD_COLUMNS)
    .eq("is_active", true)
    .is("deleted_at", null)
    .eq("shop.status", "active")
    .order("created_at", { ascending: false })
    .limit(CATEGORY_FEED_LIMIT);

  const [
    { data: newArrivals },
    { data: featuredShopsRaw },
    { count: shopsCount },
    { count: productsCount },
    { data: availableCategoriesRaw },
    catalogueResult,
    categoryFeedResult,
    facetRowsResult,
  ] = await Promise.all([
    newArrivalsQuery,
    featuredShopsQuery,
    shopsCountQuery,
    productsCountQuery,
    availableCategoriesQuery,
    hasFilter ? catalogueQuery : Promise.resolve({ data: [] as RawMarketplaceProduct[], count: 0 }),
    hasFilter ? Promise.resolve({ data: [] as RawMarketplaceProduct[] }) : categoryFeedQuery,
    hasFilter
      ? facetRowsQuery
      : Promise.resolve({ data: [] as { price: number; attributes: Record<string, string> | null }[] }),
  ]);

  const { facets, priceBounds } = computeAttributeFacets(
    categorie,
    (facetRowsResult.data ?? []) as { price: number; attributes: Record<string, string> | null }[]
  );

  const availableCategoryValues = new Set(
    ((availableCategoriesRaw ?? []) as { category: string | null }[])
      .map((p) => p.category)
      .filter((c): c is string => Boolean(c))
  );
  const availableCategories = CATEGORIES.filter((c) => availableCategoryValues.has(c.value));

  const { data: products, count } = catalogueResult;
  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;
  // Boost par palier d'abonnement (voir ranking.ts) — seulement en tri
  // "Plus récent" (le défaut) : un tri prix explicite reflète une intention
  // claire du visiteur, qu'un boost par palier n'a pas à contredire.
  // Volontairement PAGE-SCOPÉ : ne réordonne que les lignes déjà remontées
  // par `.range(...)` ci-dessus, ne change jamais quels articles atterrissent
  // sur quelle page.
  const rawCatalogueProducts = (products ?? []) as RawMarketplaceProduct[];
  const orderedCatalogueProducts =
    sort === "recent"
      ? boostByPlanWithinDay(rawCatalogueProducts, (p) => p.created_at, planRankOf)
      : rawCatalogueProducts;
  const catalogueProducts = orderedCatalogueProducts
    .map(toCardProduct)
    .filter((p): p is MarketplaceCardProduct => p !== null);
  const newArrivalsProducts = ((newArrivals ?? []) as RawMarketplaceProduct[])
    .map(toCardProduct)
    .filter((p): p is MarketplaceCardProduct => p !== null);

  // Meilleures ventes : appel best-effort à la RPC `get_best_selling_products`
  // (migration 0015). Enveloppé pour ne jamais faire échouer la page
  // d'accueil si Isaac n'a pas encore appliqué la migration — même logique
  // "best-effort" que les notifications email (ne jamais bloquer le
  // parcours principal pour une fonctionnalité secondaire).
  let bestSellingProducts: MarketplaceCardProduct[] = [];
  if (!hasFilter) {
    const { data: bestSellers, error: bestSellersError } = await supabase.rpc(
      "get_best_selling_products",
      { p_limit: BEST_SELLERS_SIZE }
    );
    if (bestSellersError) {
      console.error(
        "get_best_selling_products RPC error (migration 0015 appliquée ?):",
        bestSellersError
      );
    } else if (bestSellers && bestSellers.length > 0) {
      const ids: string[] = (bestSellers as { product_id: string }[]).map(
        (row) => row.product_id
      );
      const { data: bestSellersRaw } = await supabase
        .from("products")
        .select(PRODUCT_CARD_COLUMNS)
        .in("id", ids)
        .eq("is_active", true)
        .is("deleted_at", null)
        .eq("shop.status", "active");
      const byId = new Map<string, RawMarketplaceProduct>(
        ((bestSellersRaw ?? []) as RawMarketplaceProduct[]).map(
          (p): [string, RawMarketplaceProduct] => [p.id, p]
        )
      );
      bestSellingProducts = ids
        .map((id: string): RawMarketplaceProduct | undefined => byId.get(id))
        .filter((p): p is RawMarketplaceProduct => Boolean(p))
        .map(toCardProduct)
        .filter((p): p is MarketplaceCardProduct => p !== null);
    }
  }

  // Bandes par catégorie : regroupe le flux borné ci-dessus par catégorie,
  // dans l'ordre de `CATEGORIES`, plafonné à `CATEGORY_ROW_SIZE` par bande.
  // Une catégorie sans aucun produit actif n'apparaît simplement pas — même
  // principe que les autres bandes de découverte, jamais de bande vide.
  const categoryRows: { value: string; label: string; products: MarketplaceCardProduct[] }[] = [];
  if (!hasFilter) {
    // Boost par palier d'abonnement (ranking.ts) appliqué AVANT le
    // regroupement par catégorie ci-dessous, pour que le tri boosté soit
    // respecté à l'intérieur de chaque bande — même compromis "page-scopé"
    // que le catalogue filtré (voir plus haut) : `CATEGORY_FEED_LIMIT` fixe
    // déjà la fenêtre de produits considérée, le boost ne fait que réordonner
    // à l'intérieur de cette fenêtre.
    const boostedFeed = boostByPlanWithinDay(
      (categoryFeedResult.data ?? []) as RawMarketplaceProduct[],
      (p) => p.created_at,
      planRankOf
    );
    const feedProducts = boostedFeed
      .map(toCardProduct)
      .filter((p): p is MarketplaceCardProduct => p !== null);
    const byCategory = new Map<string, MarketplaceCardProduct[]>();
    for (const product of feedProducts) {
      if (!product.category) continue;
      const list = byCategory.get(product.category) ?? [];
      if (list.length < CATEGORY_ROW_SIZE) list.push(product);
      byCategory.set(product.category, list);
    }
    for (const cat of CATEGORIES) {
      const list = byCategory.get(cat.value);
      if (list && list.length > 0) {
        categoryRows.push({ value: cat.value, label: cat.label, products: list });
      }
    }
  }

  // Note/nombre d'avis sur les cartes produit (16/09/2026, voir migration
  // 0027_product_ratings_on_listing.sql) — un seul appel groupé pour TOUTE la
  // page (nouveautés + meilleures ventes + toutes les bandes par catégorie +
  // la grille filtrée), quel que soit le nombre de produits affichés,
  // plutôt qu'une requête par produit. Mutation en place des tableaux déjà
  // construits ci-dessus : plus simple que de reconstruire chaque liste,
  // sans changer leur forme (`rating` est un champ optionnel de
  // `MarketplaceCardProduct`).
  const allDisplayedProductIds = Array.from(
    new Set([
      ...catalogueProducts.map((p) => p.id),
      ...newArrivalsProducts.map((p) => p.id),
      ...bestSellingProducts.map((p) => p.id),
      ...categoryRows.flatMap((row) => row.products.map((p) => p.id)),
    ])
  );

  if (allDisplayedProductIds.length > 0) {
    const { data: ratingsRaw } = await supabase.rpc("get_products_ratings", {
      p_product_ids: allDisplayedProductIds,
    });
    const ratingsMap = new Map(
      (
        (ratingsRaw ?? []) as { product_id: string; average: number; review_count: number }[]
      ).map((r) => [r.product_id, { average: r.average, count: r.review_count }])
    );
    const applyRatings = (list: MarketplaceCardProduct[]) => {
      for (const p of list) p.rating = ratingsMap.get(p.id) ?? null;
    };
    applyRatings(catalogueProducts);
    applyRatings(newArrivalsProducts);
    applyRatings(bestSellingProducts);
    for (const row of categoryRows) applyRatings(row.products);
  }

  // Collage du hero : les vignettes des toutes dernières nouveautés, déjà
  // chargées ci-dessus — pas de requête supplémentaire. De vraies photos
  // envoyées par de vrais vendeurs, jamais une image de stock générique.
  const heroThumbnails = newArrivalsProducts
    .map((p) => p.thumbnail)
    .filter((url): url is string => Boolean(url))
    .slice(0, HERO_COLLAGE_SIZE);

  // Diaporama mobile du hero (16/09/2026, retour d'Isaac : sur mobile, les
  // chiffres "Boutiques actives"/"Produits en vente" prennent de la place
  // sans donner vraiment envie de cliquer — remplacés par un aperçu visuel
  // de vrais produits, façon story). Puise dans les meilleures ventes,
  // sinon dans les nouveautés si aucune vente n'existe encore (même repli
  // que la bande "Meilleures ventes" plus bas) — jamais une liste vide qui
  // ferait disparaître le bloc sans raison. Pas de nouvelle requête : ces
  // deux tableaux sont déjà chargés (et déjà notés) ci-dessus.
  const heroSlideshowPool = bestSellingProducts.length > 0 ? bestSellingProducts : newArrivalsProducts;
  const heroSlideshowProducts = shuffle(heroSlideshowPool).slice(0, HERO_SLIDESHOW_SIZE);

  // Note de confiance par boutique : réutilise `getShopRating` (0014/§4,
  // déjà utilisée sur la fiche boutique), une requête par boutique en
  // parallèle — nombre de boutiques mises en avant volontairement plafonné
  // (FEATURED_SHOPS_SIZE) pour que ce fan-out reste raisonnable.
  const featuredShops: MarketplaceShop[] = await Promise.all(
    (featuredShopsRaw ?? []).map(async (shop) => ({
      slug: shop.slug as string,
      name: shop.name as string,
      logoUrl: shop.logo_url as string | null,
      category: shop.category as string | null,
      isVerified: shop.is_verified as boolean,
      rating: await getShopRating(supabase, shop.id as string),
    }))
  );

  // Résumé des filtres actifs + compteur de résultats, affiché au-dessus de
  // la grille filtrée.
  const resultLabel = `${count ?? 0} article${(count ?? 0) === 1 ? "" : "s"}`;
  const filterSummary = q && categorie
    ? `${resultLabel} pour « ${q} » dans ${categoryLabel(categorie)}`
    : q
      ? `${resultLabel} pour « ${q} »`
      : categorie
        ? `${resultLabel} dans ${categoryLabel(categorie)}`
        : resultLabel;
  const gridTitle = categorie ? categoryLabel(categorie) : "Résultats de recherche";

    return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
      <ViewTransition enter="kv-content-in" default="none">
        <>
          {/* ========== HEADER (full width) ==========
              Passé en fond blanc le 22/09/2026 (retour d'Isaac après avis de
              devs externes : la charte cuivre/ivoire lisait comme un thème
              "IA générique" — voir decisions-techniques.md, "Fond blanc +
              accents verts"). Le vert de marque reste porté par le logo et
              les accents, plus par un bandeau plein. */}
          <header className="sticky top-0 z-20 w-full border-b border-ligne bg-white text-encre">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
              <Link href="/" className="flex shrink-0 items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/keva-logo.jpg"
                  alt="KEVA"
                  className="h-9 w-9 rounded-md object-cover"
                />
                <span className="font-display text-lg font-bold tracking-wide text-vert-sapin">
                  KEVA
                </span>
              </Link>

              <MarketplaceSearch
                defaultValue={q ?? ""}
                categorie={categorie}
                prixMin={prixMin}
                prixMax={prixMax}
                attrs={attrs}
              />

              <div className="order-2 hidden shrink-0 items-center gap-4 text-sm font-medium sm:order-3 sm:flex">
                <Link href="/favoris" className="hover:text-vert-actif">
                  Mes favoris
                </Link>
                <Link href="/compte" className="hover:text-vert-actif">
                  Mon compte
                </Link>
              </div>
            </div>
          </header>

          {/* ========== HERO (full width) ==========
              Retravaillé le 22/09/2026 (v2, voir decisions-techniques.md et
              le mockup Design "Nouvelle direction visuelle KEVA" validé par
              Isaac) : le hero est maintenant une vraie carte encadrée (coins
              arrondis, fond légèrement teinté de vert) plutôt qu'un bloc
              blanc à plat contre le header — reprend la "carte" de la
              référence sans réintroduire une couleur hors charte (juste une
              nuance très pâle du vert de marque). Le dégradé est en valeurs
              arbitraires (pas de token dédié) : usage ponctuel, propre au
              cadre du hero, pas une nouvelle surface réutilisée ailleurs. */}
          <section className="w-full bg-white px-3 pb-6 pt-2 sm:px-6 sm:pb-10">
            <div className="mx-auto max-w-6xl overflow-hidden rounded-[28px] bg-gradient-to-br from-[#f2f8f4] to-[#e8f2ec] px-5 py-12 sm:px-10 sm:py-16">
              <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-xl text-center lg:text-left">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-vert-actif">
                    Vendez · Encaissez · Grandissez
                  </p>

                  {/* Espace explicite ajouté le 23/09/2026 (bug SEO/visuel
                      signalé via un audit externe transmis par Isaac, vérifié
                      en relisant ce fichier) : le `<br>` masqué sous `sm`
                      (`hidden sm:block`) ne laissait plus aucun caractère
                      entre les deux `<span>` sur mobile, collant les deux
                      moitiés du H1 ("Toutes les boutiquesen un seul
                      endroit"). Le `{" "}` comble ce vide sur mobile sans
                      rien changer au-dessus de `sm`, où le `<br>` redevient
                      visible et l'espace se réduit avant le saut de ligne. */}
                  <h1 className="mt-4 text-balance font-display text-4xl font-black leading-[1.03] tracking-tight sm:text-5xl lg:text-[3.4rem]">
                    <span className="text-encre">Toutes les boutiques</span>{" "}
                    <br className="hidden sm:block" />
                    <span className="text-vert-actif">en un seul endroit</span>
                  </h1>

                  <p className="mt-5 max-w-md text-[15px] leading-relaxed text-encre/70">
                    Des vendeurs indépendants partout en Côte d’Ivoire.
                    Commande sans compte, paie à la livraison.
                  </p>

                  <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                    <a
                      href="#catalogue"
                      className="flex items-center gap-2 rounded-lg bg-vert-actif px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(28,107,74,0.28)] transition hover:bg-vert-sapin"
                    >
                      Voir le catalogue
                      <span aria-hidden="true">→</span>
                    </a>
                    <Link
                      href="/inscription"
                      className="rounded-lg border border-vert-sapin/25 bg-white/50 px-6 py-3 text-sm font-medium text-vert-sapin transition hover:border-vert-actif hover:text-vert-actif"
                    >
                      Ouvrir ma boutique
                    </Link>
                  </div>

                  {(shopsCount ?? 0) > 0 || (productsCount ?? 0) > 0 ? (
                    <div className="mt-10 hidden items-center gap-8 sm:flex lg:justify-start">
                      <div>
                        <p className="font-mono text-xl font-semibold text-encre">
                          {shopsCount ?? 0}
                        </p>
                        <p className="mt-0.5 text-xs text-encre/50">boutiques</p>
                      </div>
                      <div className="h-8 w-px bg-ligne" />
                      <div>
                        <p className="font-mono text-xl font-semibold text-encre">
                          {productsCount ?? 0}
                        </p>
                        <p className="mt-0.5 text-xs text-encre/50">produits</p>
                      </div>
                    </div>
                  ) : null}

                  <HeroMobileSlideshow products={heroSlideshowProducts} />
                </div>

                {heroThumbnails.length > 0 ? (
                  <div
                    className="relative hidden h-64 w-64 shrink-0 sm:block lg:h-72 lg:w-72"
                    aria-hidden="true"
                  >
                    {heroThumbnails.slice(0, 2).map((url, index) => (
                      <div
                        key={url}
                        className={`rounded-xl ${HERO_COLLAGE_POSITIONS[index]}`}
                      >
                        <ProductImage
                          src={url}
                          alt=""
                          className="h-full w-full rounded-lg object-cover"
                        />
                      </div>
                    ))}
                    {/* Case avant du collage : carrousel de vraies meilleures
                        ventes plutôt qu'une 3e vignette statique — voir
                        hero-featured-slideshow.tsx. `aria-hidden` retiré sur
                        cette seule case : contrairement aux deux autres, elle
                        est cliquable (lien vers le produit). */}
                    <div
                      className={HERO_COLLAGE_POSITIONS[2].replace("rounded-xl", "")}
                      aria-hidden={false}
                    >
                      <HeroFeaturedSlideshow
                        products={heroSlideshowProducts}
                        className="h-full w-full"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          {/* Argumentaire de confiance — déplacé juste sous le hero le
              22/09/2026 (au lieu d'être noyé après "Catégories"), pour
              reprendre la rangée de badges de confiance sous le hero vue
              dans la référence d'Isaac. Recoloré bg-sable/text-cuivre-profond
              → bg-brume/text-vert-actif au passage. */}
          <section className="mx-auto mt-8 grid w-full max-w-6xl grid-cols-1 gap-3 px-4 sm:grid-cols-3">
            {TRUST_ITEMS.map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-3 rounded-lg border border-ligne bg-white p-4"
              >
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brume text-vert-actif"
                >
                  {item.icon}
                </span>
                <div>
                  <p className="text-sm font-medium text-encre">{item.title}</p>
                  <p className="mt-1 text-xs text-encre/70">{item.body}</p>
                </div>
              </div>
            ))}
          </section>

          {/* ========== CONTENU (limité en largeur) ========== */}
          <main className="mx-auto w-full max-w-6xl px-4 pb-10">
            {/* Catégories */}
            <div id="categories" className="mt-8 scroll-mt-20">
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="font-display text-lg font-semibold text-encre">
                  Catégories
                </h2>
                <Link
                  href="/categories"
                  className="text-xs font-medium text-vert-actif underline"
                >
                  Tout voir
                </Link>
              </div>
              <CategoryNav
                buildHref={(overrides) =>
                  buildMarketplaceHref({ ...current, attrs: {} }, overrides)
                }
                active={categorie}
                availableCategories={availableCategories}
              />
            </div>

            {/* Boutiques de la plateforme */}
            {featuredShops.length > 0 ? (
              <section className="mt-10">
                <h2 className="font-display text-lg font-semibold text-encre">
                  Boutiques sur KEVA
                </h2>
                <div className="-mx-4 mt-3 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 scroll-smooth">
                  {featuredShops.map((shop) => (
                    <ShopCard
                      key={shop.slug}
                      shop={shop}
                      className="w-36 shrink-0 snap-start"
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {/* Catalogue */}
            <div id="catalogue" className="scroll-mt-20">
              {hasFilter ? (
                <section className="mt-10">
                  <div className="rounded-lg border border-ligne bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="font-display text-lg font-semibold text-encre">
                        {gridTitle}
                      </h2>
                      <SortSelect
                        basePath="/"
                        value={sort}
                        options={
                          SORTS as unknown as { value: string; label: string }[]
                        }
                        current={current}
                      />
                    </div>
                    <p className="mt-1 text-xs text-encre/60">
                      {filterSummary}
                      {" — "}
                      <Link
                        href={buildMarketplaceHref(current, {
                          q: undefined,
                          categorie: undefined,
                          prixMin: undefined,
                          prixMax: undefined,
                          attrs: {},
                          page: undefined,
                        })}
                        className="text-vert-actif underline"
                      >
                        réinitialiser les filtres
                      </Link>
                    </p>
                    <div className="mt-3">
                      <ProductFilterPanel
                        basePath="/"
                        current={current}
                        facets={facets}
                        priceBounds={priceBounds}
                      />
                    </div>
                  </div>

                  {catalogueProducts.length === 0 ? (
                    <p className="mt-10 text-sm text-encre/70">
                      Aucun article ne correspond à ta recherche.
                    </p>
                  ) : (
                    <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                      {catalogueProducts.map((product) => (
                        <ProductCard key={product.id} product={product} />
                      ))}
                    </div>
                  )}

                  {totalPages > 1 ? (
                    <div className="mt-8 flex items-center justify-center gap-2 text-sm">
                      {page > 1 ? (
                        <Link
                          href={buildMarketplaceHref(current, {
                            page: String(page - 1),
                          })}
                          className="rounded-md border border-ligne px-3 py-1.5 text-encre transition hover:border-vert-actif"
                        >
                          ‹ Précédent
                        </Link>
                      ) : (
                        <span className="rounded-md border border-ligne px-3 py-1.5 text-encre/30">
                          ‹ Précédent
                        </span>
                      )}
                      <span className="px-2 font-mono text-encre/70">
                        {page} / {totalPages}
                      </span>
                      {page < totalPages ? (
                        <Link
                          href={buildMarketplaceHref(current, {
                            page: String(page + 1),
                          })}
                          className="rounded-md border border-ligne px-3 py-1.5 text-encre transition hover:border-vert-actif"
                        >
                          Suivant ›
                        </Link>
                      ) : (
                        <span className="rounded-md border border-ligne px-3 py-1.5 text-encre/30">
                          Suivant ›
                        </span>
                      )}
                    </div>
                  ) : null}
                </section>
              ) : (
                <>
                  <RecentlyViewedRow />
                  <ProductRow title="Nouveautés" products={newArrivalsProducts} />
                  <ProductRow
                    title="Meilleures ventes"
                    products={bestSellingProducts}
                  />
                  {categoryRows.map((row) => (
                    <ProductRow
                      key={row.value}
                      title={row.label}
                      products={row.products}
                      viewAllHref={buildMarketplaceHref(current, {
                        categorie: row.value,
                        page: undefined,
                      })}
                    />
                  ))}
                  {newArrivalsProducts.length === 0 &&
                  categoryRows.length === 0 ? (
                    <p className="mt-10 text-sm text-encre/70">
                      Aucun article disponible pour l&apos;instant — reviens
                      bientôt.
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </main>
        </>
      </ViewTransition>
    </ViewTransition>
  );
}
