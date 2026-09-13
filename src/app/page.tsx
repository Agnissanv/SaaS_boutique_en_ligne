import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { categoryLabel } from "@/lib/categories";
import { SortSelect } from "@/components/sort-select";
import { CategoryNav } from "@/components/category-nav";
import { ProductCard, type MarketplaceCardProduct } from "@/components/product-card";
import { ShopCard, type MarketplaceShop } from "@/components/shop-card";
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
// Disposition refaite le 13/09/2026 : Isaac trouvait la page mal présentée
// et a partagé la page d'accueil Jumia CI comme repère de disposition — "les
// briques avant la peinture", donc uniquement la structure ici, pas encore
// les couleurs/typographie (identité visuelle toujours en attente, voir
// decisions-techniques.md). Jumia empile des dizaines de blocs (ventes
// flash, produits sponsorisés, un carrousel par catégorie...) qui supposent
// des fonctionnalités qu'on n'a pas encore (promotions, sponsoring) et un
// volume de produits par catégorie qu'un catalogue qui démarre n'a pas
// encore — copier telle quelle donnerait des carrousels à moitié vides.
// Adapté ici à ce qu'on a réellement : en-tête + recherche, catégories,
// bannière d'accroche, argumentaire de confiance, boutiques, nouveautés,
// catalogue complet filtrable. Identité visuelle volontairement neutre
// (mêmes classes Tailwind gris que le reste de l'app).
//
// Complété le 13/09/2026, à la demande d'Isaac ("quelles améliorations
// proposes-tu ?", "on a des concurrents bien musclés") : repli propre sur
// image cassée, boutique cliquable depuis une carte produit, résumé des
// filtres actifs avec compteur de résultats, en-tête collant au défilement,
// et bande "Boutiques de la plateforme".

const PAGE_SIZE = 24;
const NEW_ARRIVALS_SIZE = 8;
const FEATURED_SHOPS_SIZE = 8;

const SORTS = [
  { value: "recent", label: "Plus récent" },
  { value: "prix_asc", label: "Prix croissant" },
  { value: "prix_desc", label: "Prix décroissant" },
] as const;
type SortValue = (typeof SORTS)[number]["value"];

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

  const [
    { data: products, count },
    { data: newArrivals },
    { data: featuredShopsRaw },
  ] = await Promise.all([catalogueQuery, newArrivalsQuery, featuredShopsQuery]);

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;
  const catalogueProducts = ((products ?? []) as RawMarketplaceProduct[])
    .map(toCardProduct)
    .filter((p): p is MarketplaceCardProduct => p !== null);
  const newArrivalsProducts = ((newArrivals ?? []) as RawMarketplaceProduct[])
    .map(toCardProduct)
    .filter((p): p is MarketplaceCardProduct => p !== null);

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
    <main className="mx-auto max-w-5xl px-4 py-6">
      {/* En-tête : logo/texte de marque + recherche, réunis dans une seule
          barre (au lieu d'une recherche séparée plus bas comme avant) — la
          recherche est la première action qu'un visiteur façon Jumia doit
          voir, pas quelque chose à découvrir en scrollant. Collant au
          défilement (13/09/2026, retour d'Isaac) : reste accessible une
          fois qu'on a scrollé plus bas dans un catalogue qui s'allonge. */}
      <header className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-4 border-b border-gray-100 bg-white px-4 py-3">
        <Link href="/" className="shrink-0 text-lg font-semibold text-gray-900">
          Boutique
        </Link>
        <form method="GET" action="/" className="order-3 flex w-full gap-2 sm:order-2 sm:w-auto sm:flex-1">
          {categorie ? <input type="hidden" name="categorie" value={categorie} /> : null}
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Rechercher un article..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="shrink-0 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            Rechercher
          </button>
        </form>
        <div className="order-2 flex shrink-0 items-center gap-4 sm:order-3">
          <Link href="/favoris" className="text-sm font-medium text-gray-700 underline">
            Mes favoris
          </Link>
          <Link href="/compte" className="text-sm font-medium text-gray-700 underline">
            Mon compte
          </Link>
        </div>
      </header>

      {/* Catégories : point d'entrée principal pour parcourir le catalogue,
          juste sous l'en-tête (comme la rangée d'icônes de Jumia). */}
      <div className="mt-5">
        <CategoryNav current={current} active={categorie} />
      </div>

      {/* Bannière d'accroche : bloc d'appel, pas encore de vraie image/promo
          (rien à mettre en avant tant que les vendeurs n'ont pas de mise en
          avant/promotions — fonctionnalité qui n'existe pas encore). Le
          rectangle à droite marque l'emplacement réservé à une vraie image
          ou à un carrousel promotionnel plus tard, sans qu'il faille
          retoucher la structure de la page pour l'ajouter. */}
      <section className="mt-6 flex flex-col gap-4 rounded-lg bg-gray-900 p-6 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-md">
          <h1 className="text-xl font-semibold sm:text-2xl">
            Le catalogue de toutes les boutiques en ligne, au même endroit
          </h1>
          <p className="mt-2 text-sm text-gray-300">
            Découvre des produits vendus directement par des vendeurs
            indépendants, partout en Côte d&apos;Ivoire.
          </p>
          <Link
            href="/inscription"
            className="mt-4 inline-block rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-900"
          >
            Vendre sur la plateforme
          </Link>
        </div>
        <div
          aria-hidden="true"
          className="hidden h-32 w-56 shrink-0 rounded-md bg-white/10 sm:block"
        />
      </section>

      {/* Argumentaire de confiance : adapté de la rangée "services de
          qualité" de Jumia, avec seulement ce qui est vrai aujourd'hui (voir
          le libellé "bientôt disponible" déjà utilisé sur la page de
          paiement — CinetPay/Mobile Money n'est pas encore branché en
          production, cf. decisions-techniques.md). */}
      <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {
            title: "Paiement à la livraison",
            body: "Commande sans créer de compte, paie en espèces à la réception.",
          },
          {
            title: "Vendeurs indépendants",
            body: "Chaque boutique est gérée par son propre vendeur, partout en Côte d'Ivoire.",
          },
          {
            title: "Mobile Money bientôt disponible",
            body: "Orange Money, MTN Money, Moov Money et Wave arrivent prochainement.",
          },
        ].map((item) => (
          <div key={item.title} className="rounded-md border border-gray-200 p-3">
            <p className="text-sm font-medium text-gray-900">{item.title}</p>
            <p className="mt-1 text-xs text-gray-600">{item.body}</p>
          </div>
        ))}
      </section>

      {/* Boutiques de la plateforme : met en avant les vendeurs eux-mêmes,
          pas seulement leurs produits (ajouté le 13/09/2026, voir l'en-tête
          du fichier). Masquée si aucune boutique active n'existe encore. */}
      {featuredShops.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">Boutiques de la plateforme</h2>
          <div className="-mx-4 mt-3 flex gap-4 overflow-x-auto px-4 pb-2">
            {featuredShops.map((shop) => (
              <ShopCard key={shop.slug} shop={shop} className="w-32 shrink-0" />
            ))}
          </div>
        </section>
      ) : null}

      {/* Nouveautés : bande à défilement horizontal, indépendante des
          filtres du catalogue plus bas (voir la requête dédiée). Masquée si
          la marketplace n'a pas encore assez de produits pour que ça vaille
          le coup. */}
      {newArrivalsProducts.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">Nouveautés</h2>
          <div className="-mx-4 mt-3 flex gap-4 overflow-x-auto px-4 pb-2">
            {newArrivalsProducts.map((product) => (
              <ProductCard key={product.id} product={product} className="w-40 shrink-0" />
            ))}
          </div>
        </section>
      ) : null}

      {/* Catalogue complet : résultats filtrés/triés/paginés (fonctionnalité
          inchangée, seulement repositionnée sous les blocs de découverte
          ci-dessus au lieu d'être la première chose sur la page). */}
      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">
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
        <p className="mt-1 text-xs text-gray-500">
          {filterSummary}
          {hasFilter ? (
            <>
              {" — "}
              <Link
                href={buildMarketplaceHref(current, { q: undefined, categorie: undefined, page: undefined })}
                className="underline"
              >
                réinitialiser les filtres
              </Link>
            </>
          ) : null}
        </p>

        {catalogueProducts.length === 0 ? (
          <p className="mt-10 text-sm text-gray-600">
            {hasFilter
              ? "Aucun article ne correspond à ta recherche."
              : "Aucun article disponible pour l'instant — reviens bientôt."}
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {catalogueProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {totalPages > 1 ? (
          <div className="mt-6 flex items-center justify-center gap-4 text-sm">
            {page > 1 ? (
              <Link
                href={buildMarketplaceHref(current, { page: String(page - 1) })}
                className="underline"
              >
                Page précédente
              </Link>
            ) : (
              <span className="text-gray-400">Page précédente</span>
            )}
            <span className="text-gray-600">
              Page {page} / {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={buildMarketplaceHref(current, { page: String(page + 1) })}
                className="underline"
              >
                Page suivante
              </Link>
            ) : (
              <span className="text-gray-400">Page suivante</span>
            )}
          </div>
        ) : null}
      </section>
    </main>
  );
}
