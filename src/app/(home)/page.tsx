import Link from "next/link";
import { cookies } from "next/headers";
import { ViewTransition } from "react";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import { SortSelect } from "@/components/sort-select";
import { CategoryNav } from "@/components/category-nav";
import { ProductCard, type MarketplaceCardProduct } from "@/components/product-card";
import { ProductRow } from "@/components/product-row";
import { ShopCard, type MarketplaceShop } from "@/components/shop-card";
import { HeroMarketplace } from "@/components/hero-marketplace";
import { ScrollHeader } from "@/components/scroll-header";
import { MarketplaceSearch } from "@/components/marketplace-search";
import { RecentlyViewedRow } from "@/components/recently-viewed-row";
import { PromotionsSection } from "@/components/promotions-section";
import { BlogTeaser } from "@/components/blog-teaser";
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
import {
  boostByLocationThenPlanWithinDay,
  locationTierOf,
  type VisitorLocation,
} from "@/lib/marketplace/ranking";
import { VISITOR_LOCATION_COOKIE, parseVisitorLocationCookie } from "@/lib/geo/visitor-location";
import { loadSearchDocs } from "@/lib/search/catalog";
import { searchDocs, type SearchOutcome } from "@/lib/search/engine";
import { orderByIds, refineSearchResults } from "@/lib/search/results";

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
const NEWEST_SHOPS_SIZE = 4;
const BEST_SELLERS_SIZE = 12;
const CATEGORY_ROW_SIZE = 12;
// Nombre de produits actifs les plus récents considérés pour regrouper les
// bandes par catégorie — une seule requête groupée en JS plutôt que jusqu'à
// 24 requêtes (une par catégorie). Compromis délibéré, documenté dans
// decisions-techniques.md. Un produit plus ancien que cette fenêtre reste
// consultable via "Voir tout" (grille filtrée par catégorie, non plafonnée)
// et via la recherche — seule la bande d'aperçu peut le manquer.
const CATEGORY_FEED_LIMIT = 400;
// Échantillon borné pour le calcul des facettes de filtre (valeurs
// d'attribut réellement présentes + bornes de prix) — même pragmatisme et
// même ordre de grandeur que `CATEGORY_FEED_LIMIT` ci-dessus : un compromis
// documenté plutôt qu'une agrégation SQL dédiée, à revoir si le catalogue
// grossit significativement (voir `computeAttributeFacets`).
const FACET_SAMPLE_LIMIT = 400;

// "Pertinence" (09/10/2026, nouveau moteur de recherche) : tri par défaut
// d'une recherche texte, proposé seulement quand il y a une recherche.
const SORTS = [
  { value: "pertinence", label: "Pertinence" },
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
  // Localisation — ajoutée le 01/10/2026 (migration 0052). Voir
  // `locationTierOf` (src/lib/marketplace/ranking.ts).
  ville: string | null;
  commune: string | null;
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

type FacetRow = { price: number; attributes: Record<string, string> | null };

// Grille filtrée : une page de produits, le total, l'échantillon des
// facettes et, pour une recherche texte, ce que le moteur en a compris.
type CatalogueResult = {
  products: RawMarketplaceProduct[];
  count: number;
  facetRows: FacetRow[];
  search: {
    correctedQuery: string | null;
    categoryOnly: boolean;
    inferredCategories: string[];
    totalBeforeFilters: number;
  } | null;
};

// Rang de palier d'une ligne produit brute — normalise la forme `shop`
// (objet ou tableau selon le contexte de requête, même remarque que
// `toCardProduct` ci-dessous) et retombe sur le rang Starter (le plus bas)
// si jamais absent, plutôt que de planter le tri.
function planRankOf(product: RawMarketplaceProduct): number {
  const shop = Array.isArray(product.shop) ? product.shop[0] : product.shop;
  return shop?.plan_rank ?? 3;
}

// Même normalisation que `planRankOf` ci-dessus, pour le tri par proximité
// (voir `locationTierOf`, src/lib/marketplace/ranking.ts).
function locationTierOfProduct(
  product: RawMarketplaceProduct,
  visitor: VisitorLocation | null
): number {
  const shop = Array.isArray(product.shop) ? product.shop[0] : product.shop;
  return locationTierOf(shop?.ville, shop?.commune, visitor);
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

const PRODUCT_CARD_COLUMNS =
  "id, slug, title, price, compare_at_price, category, created_at, product_images(url, position), shop:shops!inner(slug, name, status, plan_rank, is_verified, ville, commune), sale_price, sale_starts_at, sale_ends_at";

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
  const sortOptions = SORTS.filter((s) => q || s.value !== "pertinence");
  const sort: SortValue = sortOptions.some((s) => s.value === tri)
    ? (tri as SortValue)
    : sortOptions[0].value;
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

  // Localisation du visiteur (01/10/2026, voir decisions-techniques.md) —
  // posée côté client par `LocationDetector` (position du navigateur,
  // résolue vers la ville/commune connue la plus proche, jamais envoyée à un
  // service tiers). Absente pour un premier chargement (avant que le
  // composant client n'ait eu le temps de poser le cookie et de rafraîchir
  // la page) ou si le visiteur refuse/ne supporte pas la géolocalisation —
  // dans ces cas, `locationTierOf` retombe sur le tri jour/palier existant,
  // jamais une page cassée ou des produits masqués.
  const cookieStore = await cookies();
  const visitorLocation = parseVisitorLocationCookie(
    cookieStore.get(VISITOR_LOCATION_COOKIE)?.value
  );

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

  // "Nouveaux vendeurs de la semaine" (section Promotions, 29/09/2026) — tri
  // par date de création plutôt que par `view_count` comme la bande
  // ci-dessus : l'objectif ici est de donner de la visibilité aux boutiques
  // qui viennent d'arriver (encore aucune vue), pas de remontrer les plus
  // populaires. Limite volontairement petite (voir NEWEST_SHOPS_SIZE) : un
  // encart, pas une bande de défilement complète.
  const newestShopsQuery = supabase
    .from("shops")
    .select("id, slug, name, logo_url, category, is_verified")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(NEWEST_SHOPS_SIZE);

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

  // Grille filtrée par catégorie/prix/attributs SANS recherche texte,
  // seulement construite dans ce cas — inutile de payer une requête paginée
  // de tout le catalogue quand la page par défaut n'en a plus besoin. Une
  // recherche texte passe par le moteur de recherche (`searchCatalogue`
  // plus bas).
  let catalogueQuery = supabase
    .from("products")
    .select(PRODUCT_CARD_COLUMNS, { count: "exact" })
    .eq("is_active", true)
    .is("deleted_at", null)
    .eq("shop.status", "active")
    .range(from, to);
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
  if (categorie) facetRowsQuery = facetRowsQuery.eq("category", categorie);

  // Recherche texte (09/10/2026) — remplace le `ilike '%texte%'` sur le seul
  // titre, qui ne trouvait rien pour « vêtements », « ordinateur » ou
  // « cle usb » alors que la plateforme en vend. Le moteur
  // (src/lib/search/engine.ts) classe tout le catalogue par pertinence :
  // mots du titre, de la description, des tags et des caractéristiques,
  // familles de mots (« pc » pour « ordinateur »), catégorie désignée par la
  // requête (« vêtements » -> Mode) et fautes de frappe. Les filtres de
  // catégorie, prix et attributs s'appliquent ensuite sur ses résultats,
  // avec les mêmes règles que la grille sans recherche (prix brut).
  async function searchCatalogue(query: string): Promise<CatalogueResult> {
    let outcome: SearchOutcome;
    try {
      outcome = searchDocs(await loadSearchDocs(), query);
    } catch (error) {
      console.error("Recherche marketplace : chargement du catalogue impossible", error);
      outcome = { results: [], inferredCategories: [], correctedQuery: null, hasDirectMatch: false };
    }

    const { inCategory, matches } = refineSearchResults(outcome, {
      categorie,
      prixMin,
      prixMax,
      attrs,
      sort,
    });

    const pageIds = matches.slice(from, to + 1).map((doc) => doc.id);
    let pageProducts: RawMarketplaceProduct[] = [];
    if (pageIds.length > 0) {
      const { data } = await supabase
        .from("products")
        .select(PRODUCT_CARD_COLUMNS)
        .in("id", pageIds)
        .eq("is_active", true)
        .is("deleted_at", null)
        .eq("shop.status", "active");
      pageProducts = orderByIds((data ?? []) as RawMarketplaceProduct[], pageIds);
    }

    return {
      products: pageProducts,
      count: matches.length,
      facetRows: inCategory.map((doc) => ({ price: doc.price, attributes: doc.attributes })),
      search: {
        correctedQuery: outcome.correctedQuery,
        // Résultats venus uniquement de la catégorie désignée (aucun article
        // ne contient les mots cherchés) : on le dit plutôt que de laisser
        // croire à une correspondance exacte.
        categoryOnly: outcome.results.length > 0 && !outcome.hasDirectMatch,
        inferredCategories: outcome.inferredCategories,
        totalBeforeFilters: outcome.results.length,
      },
    };
  }

  const cataloguePromise: Promise<CatalogueResult> = !hasFilter
    ? Promise.resolve({ products: [], count: 0, facetRows: [], search: null })
    : q
      ? searchCatalogue(q)
      : Promise.all([catalogueQuery, facetRowsQuery]).then(([catalogue, facetRows]) => ({
          products: (catalogue.data ?? []) as RawMarketplaceProduct[],
          count: catalogue.count ?? 0,
          facetRows: (facetRows.data ?? []) as FacetRow[],
          search: null,
        }));

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

  // Ordonnancement des requêtes (09/10/2026, performance) : la page faisait
  // ~22 requêtes en 6 vagues successives, chacune attendant la précédente
  // même sans en dépendre. Désormais 3 vagues :
  //   1. tout ce qui est indépendant (bandes, boutiques, catégories) + la RPC
  //      des meilleures ventes, lancée ci-dessous en parallèle ;
  //   2. les fiches des meilleures ventes + les notes des boutiques ;
  //   3. les notes des produits affichés (dépendent de toutes les listes).
  // Mêmes requêtes et mêmes données affichées qu'avant.
  //
  // Meilleures ventes : appel best-effort à la RPC `get_best_selling_products`
  // (migration 0015). Enveloppé pour ne jamais faire échouer la page
  // d'accueil si Isaac n'a pas encore appliqué la migration — même logique
  // "best-effort" que les notifications email (ne jamais bloquer le
  // parcours principal pour une fonctionnalité secondaire).
  const bestSellingPromise: Promise<MarketplaceCardProduct[]> = hasFilter
    ? Promise.resolve([])
    : (async () => {
        const { data: bestSellers, error: bestSellersError } = await supabase.rpc(
          "get_best_selling_products",
          { p_limit: BEST_SELLERS_SIZE }
        );
        if (bestSellersError) {
          console.error(
            "get_best_selling_products RPC error (migration 0015 appliquée ?):",
            bestSellersError
          );
          return [];
        }
        if (!bestSellers || bestSellers.length === 0) return [];
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
        return ids
          .map((id: string): RawMarketplaceProduct | undefined => byId.get(id))
          .filter((p): p is RawMarketplaceProduct => Boolean(p))
          .map(toCardProduct)
          .filter((p): p is MarketplaceCardProduct => p !== null);
      })();

  const [
    { data: newArrivals },
    { data: featuredShopsRaw },
    { data: newestShopsRaw },
    { data: availableCategoriesRaw },
    catalogueResult,
    categoryFeedResult,
  ] = await Promise.all([
    newArrivalsQuery,
    featuredShopsQuery,
    newestShopsQuery,
    availableCategoriesQuery,
    cataloguePromise,
    hasFilter ? Promise.resolve({ data: [] as RawMarketplaceProduct[] }) : categoryFeedQuery,
  ]);

  const { facets, priceBounds } = computeAttributeFacets(categorie, catalogueResult.facetRows);

  const availableCategoryValues = new Set(
    ((availableCategoriesRaw ?? []) as { category: string | null }[])
      .map((p) => p.category)
      .filter((c): c is string => Boolean(c))
  );
  const availableCategories = CATEGORIES.filter((c) => availableCategoryValues.has(c.value));

  const { products, count, search } = catalogueResult;
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
      ? boostByLocationThenPlanWithinDay(
          rawCatalogueProducts,
          (p) => locationTierOfProduct(p, visitorLocation),
          (p) => p.created_at,
          planRankOf
        )
      : rawCatalogueProducts;
  const catalogueProducts = orderedCatalogueProducts
    .map(toCardProduct)
    .filter((p): p is MarketplaceCardProduct => p !== null);
  const newArrivalsProducts = ((newArrivals ?? []) as RawMarketplaceProduct[])
    .map(toCardProduct)
    .filter((p): p is MarketplaceCardProduct => p !== null);

  // Note de confiance par boutique : réutilise `getShopRating` (0014/§4,
  // déjà utilisée sur la fiche boutique), une requête par boutique en
  // parallèle — nombre de boutiques plafonné (FEATURED_SHOPS_SIZE +
  // NEWEST_SHOPS_SIZE) pour que ce fan-out reste raisonnable. Lancée dès que
  // la liste des boutiques est connue (vague 2), en parallèle des meilleures
  // ventes, et sans doublon quand une boutique est à la fois "en vedette" et
  // "nouvelle".
  const shopRatingIds = Array.from(
    new Set([...(featuredShopsRaw ?? []), ...(newestShopsRaw ?? [])].map((shop) => shop.id as string))
  );
  const shopRatingsPromise = Promise.all(
    shopRatingIds.map(async (id) => [id, await getShopRating(supabase, id)] as const)
  ).then((entries) => new Map(entries));

  const bestSellingProducts = await bestSellingPromise;

  // Bandes par catégorie : regroupe le flux borné ci-dessus par catégorie,
  // dans l'ordre de `CATEGORIES`, plafonné à `CATEGORY_ROW_SIZE` par bande.
  // Une catégorie sans aucun produit actif n'apparaît simplement pas — même
  // principe que les autres bandes de découverte, jamais de bande vide.
  const categoryRows: { value: string; label: string; products: MarketplaceCardProduct[] }[] = [];
  // Produits récents de toute la fenêtre `CATEGORY_FEED_LIMIT` (avant
  // plafonnement par bande) — sert aussi à calculer la remise du badge du hero
  // (voir `heroPromoDiscount` plus bas).
  let feedPoolProducts: MarketplaceCardProduct[] = [];
  if (!hasFilter) {
    // Boost par palier d'abonnement (ranking.ts) appliqué AVANT le
    // regroupement par catégorie ci-dessous, pour que le tri boosté soit
    // respecté à l'intérieur de chaque bande — même compromis "page-scopé"
    // que le catalogue filtré (voir plus haut) : `CATEGORY_FEED_LIMIT` fixe
    // déjà la fenêtre de produits considérée, le boost ne fait que réordonner
    // à l'intérieur de cette fenêtre.
    const boostedFeed = boostByLocationThenPlanWithinDay(
      (categoryFeedResult.data ?? []) as RawMarketplaceProduct[],
      (p) => locationTierOfProduct(p, visitorLocation),
      (p) => p.created_at,
      planRankOf
    );
    const feedProducts = boostedFeed
      .map(toCardProduct)
      .filter((p): p is MarketplaceCardProduct => p !== null);
    feedPoolProducts = feedProducts;
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

  // Notes des boutiques lancées plus haut (vague 2) : en général déjà
  // arrivées à ce stade, pendant que les notes produit étaient chargées.
  const shopRatings = await shopRatingsPromise;
  const toMarketplaceShop = (shop: NonNullable<typeof featuredShopsRaw>[number]): MarketplaceShop => ({
    slug: shop.slug as string,
    name: shop.name as string,
    logoUrl: shop.logo_url as string | null,
    category: shop.category as string | null,
    isVerified: shop.is_verified as boolean,
    rating: shopRatings.get(shop.id as string) ?? null,
  });
  const featuredShops: MarketplaceShop[] = (featuredShopsRaw ?? []).map(toMarketplaceShop);
  // Section Promotions ("Nouveaux vendeurs de la semaine"), même mise en forme.
  const newestShops: MarketplaceShop[] = (newestShopsRaw ?? []).map(toMarketplaceShop);

  // Données du hero (09/10/2026) — uniquement à partir de données réelles déjà
  // chargées ci-dessus, aucune requête de plus. Pastilles : catégories qui ont
  // au moins un produit. Badge "Jusqu'à -X %" : plus forte remise parmi les
  // promotions réellement actives, absent s'il n'y en a aucune.
  const heroCategories = availableCategories.map((c) => ({
    value: c.value,
    label: c.label,
    href: buildMarketplaceHref({ ...current, attrs: {} }, { categorie: c.value, page: undefined }),
  }));
  const discountsOnSale = [...newArrivalsProducts, ...feedPoolProducts]
    .filter((p) => p.isOnSale && p.compareAtPrice && p.compareAtPrice > p.price)
    .map((p) => Math.round((1 - p.price / (p.compareAtPrice as number)) * 100))
    .filter((percent) => percent > 0);
  const heroPromoDiscount = discountsOnSale.length > 0 ? Math.max(...discountsOnSale) : null;

  // Résumé des filtres actifs + compteur de résultats, affiché au-dessus de
  // la grille filtrée.
  // Requête affichée : la version corrigée quand le moteur a rattrapé une
  // faute de frappe (« ordinatuer » -> « ordinateur »).
  const displayQuery = search?.correctedQuery ?? q;
  const resultLabel = `${count ?? 0} article${(count ?? 0) <= 1 ? "" : "s"}`;
  const filterSummary = displayQuery && categorie
    ? `${resultLabel} pour « ${displayQuery} » dans ${categoryLabel(categorie)}`
    : displayQuery
      ? `${resultLabel} pour « ${displayQuery} »`
      : categorie
        ? `${resultLabel} dans ${categoryLabel(categorie)}`
        : resultLabel;
  const gridTitle = categorie ? categoryLabel(categorie) : "Résultats de recherche";

  // Rayons désignés par la recherche (« ordinateur » -> Informatique) qui ont
  // réellement des produits : proposés en raccourcis sous le résumé, et
  // nommés quand les résultats ne viennent que de là.
  const searchCategories = (search?.inferredCategories ?? [])
    .filter((value) => availableCategoryValues.has(value))
    .slice(0, 3)
    .map((value) => ({
      value,
      label: categoryLabel(value),
      href: buildMarketplaceHref({}, { categorie: value }),
    }));
  // La recherche trouve des articles, mais les filtres (rayon, prix,
  // caractéristiques) les ont tous écartés.
  const filtersHideResults = Boolean(
    search && search.totalBeforeFilters > 0 && catalogueProducts.length === 0 && page === 1
  );

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
              les accents, plus par un bandeau plein.

              09/10/2026 (demande d'Isaac) : barre transparente en haut de
              page, qui se remplit en fondu au défilement (voir `ScrollHeader`).
              Tant qu'elle est transparente, les liens de droite sont posés sur
              une pastille blanche translucide pour rester lisibles par-dessus
              les visuels sombres du hero. */}
          <ScrollHeader>
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
              <Link
                href="/"
                className="flex shrink-0 items-center gap-2 rounded-full bg-white/80 py-1 pl-1 pr-3 backdrop-blur-sm transition group-data-[scrolled=true]:bg-transparent"
              >
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
                <Link
                  href="/favoris"
                  className="rounded-full bg-white/80 px-3.5 py-1.5 backdrop-blur-sm transition hover:text-vert-actif group-data-[scrolled=true]:bg-transparent"
                >
                  Mes favoris
                </Link>
                <Link
                  href="/compte"
                  className="rounded-full bg-white/80 px-3.5 py-1.5 backdrop-blur-sm transition hover:text-vert-actif group-data-[scrolled=true]:bg-transparent"
                >
                  Mon compte
                </Link>
              </div>
            </div>
          </ScrollHeader>

          {/* ========== HERO (full width) ==========
              Refonte du 09/10/2026, sur le modèle fourni par Isaac
              (`public/hero/model.jpeg`) : bandeau pleine largeur avec texte,
              recherche et pastilles de catégories, carrousel de visuels
              derrière. Le <h1> ("la plus simple de Côte d'Ivoire") reste celui
              voulu par Isaac le 02/10/2026. Le badge de promotion n'apparaît
              que s'il existe une vraie promo (`heroPromoDiscount`). */}
          <HeroMarketplace
            categories={heroCategories}
            promoDiscount={heroPromoDiscount}
            search={{ defaultValue: q ?? "", categorie, prixMin, prixMax, attrs }}
          />

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
            {/* Indicateur de proximité (01/10/2026) — visible uniquement en
                mode par défaut (pas de recherche/filtre explicite) : confirme
                au visiteur que ce qu'il voit est influencé par sa position,
                sans jamais annoncer "près de toi" sur une grille de résultats
                de recherche qui n'a rien à voir avec la proximité. */}
            {!hasFilter && visitorLocation ? (
              <p className="mt-6 flex items-center gap-1.5 text-xs font-medium text-vert-sapin">
                <span aria-hidden="true">📍</span>
                Produits proches de toi d&apos;abord — {visitorLocation.commune ?? visitorLocation.ville}
              </p>
            ) : null}

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
            <div id="catalogue" data-search-results className="scroll-mt-20">
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
                          sortOptions as unknown as { value: string; label: string }[]
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
                          tri: undefined,
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
                    {search?.correctedQuery ? (
                      <p className="mt-2 text-sm text-encre/80">
                        Résultats pour{" "}
                        <span className="font-semibold text-encre">« {search.correctedQuery} »</span>
                        {" "}— tu as tapé « {q} ».
                      </p>
                    ) : null}
                    {search?.categoryOnly && catalogueProducts.length > 0 ? (
                      <p className="mt-2 text-sm text-encre/80">
                        Aucun article ne mentionne « {displayQuery} » mot pour mot. Voici
                        des articles du même rayon
                        {searchCategories.length > 0
                          ? ` (${searchCategories.map((c) => c.label).join(", ")})`
                          : ""}
                        {" "}qui peuvent t&apos;intéresser.
                      </p>
                    ) : null}
                    {searchCategories.some((c) => c.value !== categorie) ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-encre/60">Voir tout le rayon :</span>
                        {searchCategories
                          .filter((c) => c.value !== categorie)
                          .map((c) => (
                            <Link
                              key={c.value}
                              href={c.href}
                              className="rounded-full border border-ligne px-3 py-1 font-medium text-encre transition hover:border-vert-actif hover:text-vert-actif"
                            >
                              {c.label}
                            </Link>
                          ))}
                      </div>
                    ) : null}
                    <div className="mt-3">
                      <ProductFilterPanel
                        basePath="/"
                        current={current}
                        facets={facets}
                        priceBounds={priceBounds}
                      />
                    </div>
                  </div>

                  {/* Jamais de page vide (09/10/2026, demande d'Isaac : « tu ne
                      vas jamais voir sur une plateforme où on te dit qu'il n'y
                      a aucun résultat ») : si les filtres écartent tout, lien
                      vers les résultats sans filtre ; sinon, des articles
                      récents à découvrir à la place. */}
                  {catalogueProducts.length === 0 ? (
                    <div className="mt-8">
                      {filtersHideResults && search ? (
                        <p className="text-sm text-encre/80">
                          Aucun article ne correspond à tous ces filtres.{" "}
                          <Link
                            href={buildMarketplaceHref({}, { q })}
                            className="font-medium text-vert-actif underline"
                          >
                            Voir les {search.totalBeforeFilters} article
                            {search.totalBeforeFilters === 1 ? "" : "s"} pour « {displayQuery} »
                            sans filtre
                          </Link>
                        </p>
                      ) : (
                        <p className="text-sm text-encre/80">
                          {q
                            ? `Rien sur KEVA ne ressemble encore à « ${displayQuery} ».`
                            : "Aucun article ne correspond à ces filtres pour l'instant."}{" "}
                          Parcours les catégories ci-dessus, ou découvre les derniers
                          articles publiés :
                        </p>
                      )}
                      {!filtersHideResults && newArrivalsProducts.length > 0 ? (
                        <>
                          <h3 className="mt-6 font-display text-base font-semibold text-encre">
                            Tu pourrais aimer
                          </h3>
                          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                            {newArrivalsProducts.map((product) => (
                              <ProductCard key={product.id} product={product} />
                            ))}
                          </div>
                        </>
                      ) : null}
                    </div>
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

          {/* ========== PROMOTIONS + BLOG (adaptation de la référence
              d'Isaac, 29/09/2026) ==========
              Occupe, dans l'ordre de la page de référence (Promotions puis
              Newsletter juste avant le footer), les deux positions
              "Promotions" et "Newsletter" — voir promotions-section.tsx et
              blog-teaser.tsx pour le détail de chaque adaptation (jamais de
              fausse réduction ni de collecte d'email, les deux partis pris
              de la référence écartés par Isaac/Claude avant de coder). Le
              footer, lui, est global (voir layout.tsx), pas répété ici. */}
          <div className="mx-auto w-full max-w-6xl px-4">
            <PromotionsSection newestShops={newestShops} />
            <BlogTeaser />
          </div>
        </>
      </ViewTransition>
    </ViewTransition>
  );
}
