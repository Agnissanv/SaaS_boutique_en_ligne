import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { categoryLabel } from "@/lib/categories";
import { SortSelect } from "@/components/sort-select";
import { CategoryNav } from "@/components/category-nav";
import { ProductCard, type MarketplaceCardProduct } from "@/components/product-card";
import { ShopCard, type MarketplaceShop } from "@/components/shop-card";
import { ProductImage } from "@/components/product-image";
import { buildMarketplaceHref } from "@/lib/marketplace/filters";
import { getShopRating } from "@/lib/reviews";

// Marketplace publique : découverte multi-boutiques (cf. demande d'Isaac du
// 13/09/2026 — équivalent d'un "atterrissage" façon Jumia, en complément du
// lien direct `/[shopSlug]` que chaque vendeur partage sur WhatsApp/Instagram).
// Le cahier des charges classe la "marketplace globale (recherche
// multi-boutiques)" en Priorité 3 (roadmap long terme) ; construite ici par
// anticipation, à la demande explicite d'Isaac plutôt que dans l'ordre du
// cahier des charges — voir decisions-techniques.md.
//
// Refonte visuelle du 15/09/2026 : cette page est la vitrine de toute la
// plateforme (le point d'entrée de chaque visiteur, pas un espace vendeur),
// Isaac a explicitement demandé qu'elle soit traitée avec plus d'ambition
// que la page boutique — véritable hero avec la signature de marque KEVA
// ("Vendez. Encaissez. Grandissez.", jamais intégrée visuellement jusqu'ici),
// un collage de vraies photos produit (jamais une image de stock), et des
// chiffres réels de la plateforme (nombre de boutiques/produits actifs —
// calculés à la volée, jamais une valeur inventée pour "faire plein").
// Structure/fonctionnalités inchangées : recherche, catégories, boutiques
// mises en avant, nouveautés, catalogue filtrable/triable/paginé.

const PAGE_SIZE = 24;
const NEW_ARRIVALS_SIZE = 8;
const FEATURED_SHOPS_SIZE = 8;
const HERO_COLLAGE_SIZE = 3;

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
const HERO_COLLAGE_POSITIONS = [
  "absolute left-0 top-6 h-32 w-32 -rotate-6 border-4 border-ivoire/15 shadow-xl",
  "absolute right-2 top-0 z-10 h-28 w-28 rotate-3 border-4 border-ivoire/15 shadow-xl",
  "absolute bottom-0 left-16 z-20 h-28 w-28 rotate-2 border-4 border-ivoire/15 shadow-xl",
];

// Icônes de l'argumentaire de confiance — dessinées à la main en SVG inline,
// même parti pris que les icônes de la sidebar du dashboard vendeur
// (15/09/2026) : pas de dépendance à une librairie d'icônes, pas d'emoji.
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

type RawMarketplaceProduct = {
  id: string;
  slug: string;
  title: string;
  price: number;
  category: string | null;
  product_images: { url: string; position: number }[];
  shop: { slug: string; name: string } | { slug: string; name: string }[] | null;
};

// Normalise la forme `shop` renvoyée par Supabase (objet ou tableau selon le
// contexte de la requête) et calcule la vignette — utilisé pour les deux
// requêtes produit de cette page (nouveautés + catalogue), d'où l'extraction
// ici plutôt qu'une logique dupliquée dans les deux `.map()`.
function toCardProduct(product: RawMarketplaceProduct): MarketplaceCardProduct | null {
  const shop = Array.isArray(product.shop) ? product.shop[0] : product.shop;
  if (!shop) return null;
  const thumbnail = [...(product.product_images ?? [])].sort(
    (a, b) => a.position - b.position
  )[0]?.url;
  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    price: product.price,
    category: product.category,
    thumbnail,
    shopSlug: shop.slug,
    shopName: shop.name,
  };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categorie?: string; tri?: string; page?: string }>;
}) {
  const { q, categorie, tri, page: pageParam } = await searchParams;
  const sort: SortValue = SORTS.some((s) => s.value === tri) ? (tri as SortValue) : "recent";
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const current = { q, categorie, tri, page: pageParam };

  const supabase = await createClient();

  let catalogueQuery = supabase
    .from("products")
    .select(
      "id, slug, title, price, category, product_images(url, position), shop:shops!inner(slug, name, status)",
      { count: "exact" }
    )
    .eq("is_active", true)
    .is("deleted_at", null)
    .eq("shop.status", "active")
    .range(from, to);

  if (q) catalogueQuery = catalogueQuery.ilike("title", `%${q}%`);
  if (categorie) catalogueQuery = catalogueQuery.eq("category", categorie);
  if (sort === "prix_asc") catalogueQuery = catalogueQuery.order("price", { ascending: true });
  else if (sort === "prix_desc")
    catalogueQuery = catalogueQuery.order("price", { ascending: false });
  else catalogueQuery = catalogueQuery.order("created_at", { ascending: false });

  // Bande "Nouveautés" : toujours les produits les plus récents de toute la
  // marketplace, indépendamment des filtres en cours (comme les carrousels
  // de découverte de Jumia) — une requête à part plutôt qu'un sous-ensemble
  // de la requête catalogue, qui elle dépend de la recherche/catégorie/tri.
  // Sert aussi de source pour le collage de photos du hero (voir plus bas).
  const newArrivalsQuery = supabase
    .from("products")
    .select(
      "id, slug, title, price, category, product_images(url, position), shop:shops!inner(slug, name, status)"
    )
    .eq("is_active", true)
    .is("deleted_at", null)
    .eq("shop.status", "active")
    .order("created_at", { ascending: false })
    .limit(NEW_ARRIVALS_SIZE);

  // Bande "Boutiques de la plateforme" : jusqu'ici la marketplace ne mettait
  // en avant que des produits, jamais les boutiques elles-mêmes (noté "non
  // fait" le 13/09/2026 à la construction initiale). Tri par nombre de vues
  // (`shops.view_count`, existant depuis le 13/09/2026) — un signal de
  // popularité simple, sans introduire de nouvelle notion.
  const featuredShopsQuery = supabase
    .from("shops")
    .select("id, slug, name, logo_url, category")
    .eq("status", "active")
    .order("view_count", { ascending: false })
    .limit(FEATURED_SHOPS_SIZE);

  // Chiffres réels de la plateforme, affichés dans le hero — ajouté le
  // 15/09/2026 dans le cadre de la refonte visuelle. `head: true` : on ne
  // veut que le compte, jamais les lignes elles-mêmes, donc pas de coût de
  // transfert supplémentaire. Jamais une valeur inventée pour "faire plein"
  // (même principe que la barre de santé du stock ou le badge "vendeur
  // vérifié" écarté ailleurs) : si la plateforme est encore petite, le
  // chiffre réel s'affiche tel quel.
  const shopsCountQuery = supabase
    .from("shops")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  const productsCountQuery = supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .is("deleted_at", null);

  const [
    { data: products, count },
    { data: newArrivals },
    { data: featuredShopsRaw },
    { count: shopsCount },
    { count: productsCount },
  ] = await Promise.all([
    catalogueQuery,
    newArrivalsQuery,
    featuredShopsQuery,
    shopsCountQuery,
    productsCountQuery,
  ]);

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;
  const catalogueProducts = ((products ?? []) as RawMarketplaceProduct[])
    .map(toCardProduct)
    .filter((p): p is MarketplaceCardProduct => p !== null);
  const newArrivalsProducts = ((newArrivals ?? []) as RawMarketplaceProduct[])
    .map(toCardProduct)
    .filter((p): p is MarketplaceCardProduct => p !== null);

  // Collage du hero : les vignettes des toutes dernières nouveautés, déjà
  // chargées ci-dessus — pas de requête supplémentaire. De vraies photos
  // envoyées par de vrais vendeurs, jamais une image de stock générique.
  const heroThumbnails = newArrivalsProducts
    .map((p) => p.thumbnail)
    .filter((url): url is string => Boolean(url))
    .slice(0, HERO_COLLAGE_SIZE);

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
      rating: await getShopRating(supabase, shop.id as string),
    }))
  );

  // Résumé des filtres actifs + compteur de résultats, affiché au-dessus de
  // la grille du catalogue (retour d'Isaac : un lien "réinitialiser"
  // n'existait qu'en cas de recherche texte, pas de filtre catégorie seul —
  // et rien n'indiquait le nombre de résultats en dehors d'un filtre).
  const hasFilter = Boolean(q || categorie);
  const resultLabel = `${count ?? 0} article${(count ?? 0) === 1 ? "" : "s"}`;
  const filterSummary = q && categorie
    ? `${resultLabel} pour « ${q} » dans ${categoryLabel(categorie)}`
    : q
      ? `${resultLabel} pour « ${q} »`
      : categorie
        ? `${resultLabel} dans ${categoryLabel(categorie)}`
        : `${resultLabel} au catalogue`;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-10">
      {/* En-tête : logo/texte de marque + recherche, réunis dans une seule
          barre. Collant au défilement (13/09/2026, retour d'Isaac) : reste
          accessible une fois qu'on a scrollé plus bas dans un catalogue qui
          s'allonge. */}
      <header className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-4 bg-vert-sapin px-4 py-3 text-ivoire">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo statique, pas besoin de next/image ici */}
          <img src="/keva-logo.jpg" alt="KEVA" className="h-9 w-9 rounded-md object-cover" />
          <span className="font-display text-lg font-semibold tracking-tight">KEVA</span>
        </Link>
        <form method="GET" action="/" className="order-3 flex w-full gap-2 sm:order-2 sm:w-auto sm:flex-1">
          {categorie ? <input type="hidden" name="categorie" value={categorie} /> : null}
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
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
        <div className="order-2 flex shrink-0 items-center gap-4 text-sm font-medium sm:order-3">
          <Link href="/favoris" className="hover:text-cuivre-clair">
            Mes favoris
          </Link>
          <Link href="/compte" className="hover:text-cuivre-clair">
            Mon compte
          </Link>
        </div>
      </header>

      {/* Hero : vitrine de toute la plateforme, retravaillée le 15/09/2026 à
          la demande explicite d'Isaac ("mille fois plus beau" que la page
          boutique). Signature de marque KEVA ("Vendez. Encaissez.
          Grandissez.", choisie le 15/09/2026 mais jamais encore intégrée
          visuellement) en eyebrow, gros titre en Fraunces, et un collage de
          vraies photos produit à droite plutôt qu'un rectangle vide. */}
      <section className="-mx-4 bg-vert-profond px-4 py-12 text-ivoire sm:py-16">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl text-center lg:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cuivre-clair">
              Vendez · Encaissez · Grandissez
            </p>
            <h1 className="mt-3 text-balance font-display text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">
              Le catalogue de toutes les boutiques en ligne, au même endroit
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-ivoire/70">
              Découvre des produits vendus directement par des vendeurs
              indépendants, partout en Côte d&apos;Ivoire — commande sans
              compte, paie à la livraison.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <a
                href="#catalogue"
                className="rounded-md bg-cuivre-profond px-5 py-2.5 text-sm font-semibold text-ivoire transition hover:bg-cuivre"
              >
                Découvrir le catalogue
              </a>
              <Link
                href="/inscription"
                className="rounded-md border border-ivoire/25 px-5 py-2.5 text-sm font-medium text-ivoire transition hover:border-cuivre-clair hover:text-cuivre-clair"
              >
                Vendre sur la plateforme
              </Link>
            </div>
            {(shopsCount ?? 0) > 0 || (productsCount ?? 0) > 0 ? (
              <dl className="mt-9 flex flex-wrap justify-center gap-x-10 gap-y-3 lg:justify-start">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-ivoire/50">
                    Boutiques actives
                  </dt>
                  <dd className="font-mono text-2xl font-semibold text-ivoire">
                    {shopsCount ?? 0}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-ivoire/50">
                    Produits en vente
                  </dt>
                  <dd className="font-mono text-2xl font-semibold text-ivoire">
                    {productsCount ?? 0}
                  </dd>
                </div>
              </dl>
            ) : null}
          </div>

          {heroThumbnails.length > 0 ? (
            <div className="relative hidden h-52 w-52 shrink-0 sm:block" aria-hidden="true">
              {heroThumbnails.map((url, index) => (
                <div key={url} className={`rounded-xl ${HERO_COLLAGE_POSITIONS[index]}`}>
                  <ProductImage src={url} alt="" className="h-full w-full rounded-lg object-cover" />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* Catégories : point d'entrée principal pour parcourir le catalogue,
          juste sous le hero. */}
      <div className="mt-8">
        <CategoryNav current={current} active={categorie} />
      </div>

      {/* Argumentaire de confiance : adapté de la rangée "services de
          qualité" de Jumia, avec seulement ce qui est vrai aujourd'hui (voir
          le libellé "bientôt disponible" déjà utilisé sur la page de
          paiement — CinetPay/Mobile Money n'est pas encore branché en
          production, cf. decisions-techniques.md). Icônes dessinées à la
          main, ajoutées le 15/09/2026 (auparavant du texte seul). */}
      <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {TRUST_ITEMS.map((item) => (
          <div key={item.title} className="flex items-start gap-3 rounded-lg border border-ligne bg-white p-4">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sable text-cuivre-profond"
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

      {/* Boutiques de la plateforme : met en avant les vendeurs eux-mêmes,
          pas seulement leurs produits. Masquée si aucune boutique active
          n'existe encore. Défilement en douceur (`snap-x`) ajouté le
          15/09/2026. */}
      {featuredShops.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-display text-lg font-semibold text-encre">Boutiques de la plateforme</h2>
          <div className="-mx-4 mt-3 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 scroll-smooth">
            {featuredShops.map((shop) => (
              <ShopCard key={shop.slug} shop={shop} className="w-36 shrink-0 snap-start" />
            ))}
          </div>
        </section>
      ) : null}

      {/* Nouveautés : bande à défilement horizontal, indépendante des
          filtres du catalogue plus bas (voir la requête dédiée). Masquée si
          la marketplace n'a pas encore assez de produits pour que ça vaille
          le coup. */}
      {newArrivalsProducts.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-display text-lg font-semibold text-encre">Nouveautés</h2>
          <div className="-mx-4 mt-3 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 scroll-smooth">
            {newArrivalsProducts.map((product) => (
              <ProductCard key={product.id} product={product} className="w-44 shrink-0 snap-start" />
            ))}
          </div>
        </section>
      ) : null}

      {/* Catalogue complet : résultats filtrés/triés/paginés (fonctionnalité
          inchangée). Regroupé dans une carte comme les filtres de la page
          boutique/du dashboard vendeur, pour une cohérence entre les pages
          déjà retravaillées le même jour. */}
      <section id="catalogue" className="mt-10 scroll-mt-20">
        <div className="rounded-lg border border-ligne bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-encre">
              {categorie ? categoryLabel(categorie) : "Tout le catalogue"}
            </h2>
            <SortSelect
              basePath="/"
              value={sort}
              options={SORTS as unknown as { value: string; label: string }[]}
              q={q}
              categorie={categorie}
            />
          </div>
          <p className="mt-1 text-xs text-encre/60">
            {filterSummary}
            {hasFilter ? (
              <>
                {" — "}
                <Link
                  href={buildMarketplaceHref(current, { q: undefined, categorie: undefined, page: undefined })}
                  className="text-vert-actif underline"
                >
                  réinitialiser les filtres
                </Link>
              </>
            ) : null}
          </p>
        </div>

        {catalogueProducts.length === 0 ? (
          <p className="mt-10 text-sm text-encre/70">
            {hasFilter
              ? "Aucun article ne correspond à ta recherche."
              : "Aucun article disponible pour l'instant — reviens bientôt."}
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
                href={buildMarketplaceHref(current, { page: String(page - 1) })}
                className="rounded-md border border-ligne px-3 py-1.5 text-encre transition hover:border-cuivre-clair"
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
                href={buildMarketplaceHref(current, { page: String(page + 1) })}
                className="rounded-md border border-ligne px-3 py-1.5 text-encre transition hover:border-cuivre-clair"
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
    </main>
  );
}
