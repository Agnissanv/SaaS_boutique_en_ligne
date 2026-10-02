import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { BLOG_POSTS } from "@/lib/blog-posts";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

type ShopRow = { slug: string; updated_at: string };
type ProductRow = {
  slug: string;
  updated_at: string;
  shop: { slug: string; status: string } | { slug: string; status: string }[] | null;
};

/**
 * `sitemap.ts` — ajouté le 21/09/2026, en prévision du lancement (achat du
 * nom de domaine `shopkeva.com` chez Spaceship, demande explicite d'Isaac
 * "créer un fichier sitemap... pour que je puisse indexer").
 *
 * Généré dynamiquement (pas un `sitemap.xml` statique) : les boutiques et
 * fiches produit changent en continu (nouvelles boutiques, nouveaux
 * produits, désactivations), donc un fichier figé au moment du build serait
 * obsolète dès le lendemain. `createClient()` lit les cookies de la requête
 * (voir src/lib/supabase/server.ts) mais aucune session n'est requise ici —
 * les mêmes politiques RLS de lecture publique que les pages boutique/produit
 * elles-mêmes s'appliquent (lecture anonyme des boutiques `status = 'active'`
 * et produits `is_active = true`).
 *
 * Périmètre volontairement limité aux pages qui ont une vraie valeur SEO :
 * l'accueil, `/categories`, `/blog` et ses articles, `/faq` (ajoutée le
 * 02/10/2026, chantier GEO), les pages marketing/légales (`/tarifs`,
 * `/contact`, `/charte-vendeur`, `/conditions-utilisation`,
 * `/politique-confidentialite`), chaque boutique active et chaque produit
 * actif non supprimé d'une boutique active.
 * Commentaire mis à jour le 30/09/2026 (audit technique) pour refléter les
 * pages marketing/légales ajoutées ce jour-là (trou depuis leur création) et
 * le blog (29/09/2026), oublié ici au moment de son ajout. Tout le reste
 * (auth, comptes, panier, commandes, dashboard, admin, espace commercial) est
 * privé ou propre à une session — exclu ici ET dans `robots.ts`.
 *
 * `/categories` ne liste pas une entrée par catégorie : le filtrage par
 * catégorie se fait via un paramètre de requête sur `/` (`buildMarketplaceHref`,
 * voir src/lib/marketplace/filters.ts), pas des routes dédiées — inutile de
 * les lister séparément, Google indexe déjà `/categories` comme point d'entrée.
 *
 * Pas de pagination sur les requêtes ci-dessous : au volume actuel de la
 * plateforme (lancement V1), le coût reste négligeable — même compromis
 * assumé ailleurs dans le projet (ex. `CATEGORIES` counts sur la page
 * d'accueil marketplace). À revoir avec `generateSitemaps()` si le catalogue
 * dépasse plusieurs milliers de produits.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  const [{ data: shopsData }, { data: productsData }] = await Promise.all([
    supabase
      .from("shops")
      .select("slug, updated_at")
      .eq("status", "active"),
    supabase
      .from("products")
      .select("slug, updated_at, shop:shops!inner(slug, status)")
      .eq("is_active", true)
      .is("deleted_at", null)
      .eq("shop.status", "active"),
  ]);

  const shops = (shopsData ?? []) as ShopRow[];
  const products = (productsData ?? []) as ProductRow[];

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/categories`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${siteUrl}/faq`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    // Pages marketing/légales (30/09/2026, audit technique — voir
    // audit-technique-2026-09-29.md) : oubliées ici depuis leur création,
    // alors qu'elles ont chacune leurs propres `metadata` (title/description)
    // et ne sont pas exclues par `robots.ts` — un vrai trou, pas un choix
    // délibéré comme les routes listées dans le commentaire d'en-tête
    // ci-dessus. `/tarifs` en particulier est la page d'atterrissage
    // vendeur — pas de valeur SEO à la laisser hors du sitemap.
    {
      url: `${siteUrl}/tarifs`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/charte-vendeur`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/conditions-utilisation`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/politique-confidentialite`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  // Articles de blog (29/09/2026, chantier SEO — voir blog-posts.ts) : ajoutés
  // ici pour la même raison que le reste de ce fichier, indexation par
  // Google, but explicite de ce chantier.
  const blogEntries: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => ({
    url: `${siteUrl}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt),
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  const shopEntries: MetadataRoute.Sitemap = shops.map((shop) => ({
    url: `${siteUrl}/${shop.slug}`,
    lastModified: new Date(shop.updated_at),
    changeFrequency: "daily",
    priority: 0.7,
  }));

  const productEntries: MetadataRoute.Sitemap = products
    .map((product) => {
      const shop = Array.isArray(product.shop) ? product.shop[0] : product.shop;
      if (!shop) return null;
      return {
        url: `${siteUrl}/${shop.slug}/${product.slug}`,
        lastModified: new Date(product.updated_at),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return [...staticEntries, ...blogEntries, ...shopEntries, ...productEntries];
}
