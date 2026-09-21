import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * `robots.ts` — ajouté le 21/09/2026, en prévision du lancement (achat du
 * nom de domaine `shopkeva.com` chez Spaceship). Jusqu'ici aucun fichier
 * robots.txt n'existait : les moteurs de recherche appliquaient leur
 * comportement par défaut (tout indexer), y compris les espaces privés
 * (dashboard vendeur, back-office admin, compte client, tunnel de paiement)
 * qui n'ont aucune valeur SEO et ne devraient jamais apparaître dans des
 * résultats de recherche.
 *
 * Seules les pages publiques de la marketplace restent indexables :
 * l'accueil (`/`), `/categories`, les boutiques (`/[shopSlug]`) et leurs
 * fiches produit (`/[shopSlug]/[productSlug]`) — exactement le périmètre
 * couvert par `sitemap.ts` (voir ce fichier pour le détail du raisonnement).
 * Tout le reste (auth, comptes, panier, tunnel de commande, favoris
 * localStorage) est explicitement exclu : soit privé, soit sans intérêt
 * pour un moteur de recherche.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        "/connexion",
        "/connexion/",
        "/inscription",
        "/dashboard",
        "/dashboard/",
        "/admin",
        "/admin/",
        "/compte",
        "/compte/",
        // Favoris : page client basée sur le localStorage du navigateur
        // (voir favoris/page.tsx) — vide et sans contenu pour un robot,
        // jamais un vrai compte utilisateur.
        "/favoris",
        // Panier et tunnel de commande de chaque boutique : contenu propre
        // à une session, jamais la même page d'une visite à l'autre.
        "/*/panier",
        "/*/commande/",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
