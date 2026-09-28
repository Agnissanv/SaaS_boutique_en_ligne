import type { NextConfig } from "next";

// En-têtes de sécurité HTTP — ajoutés le 28/09/2026 (audit pré-lancement,
// juste avant le branchement de la vraie clé Nyole en production). Absents
// jusqu'ici : aucun `headers()` dans ce fichier, aucun `vercel.json`
// équivalent, donc aucune protection navigateur au-delà de ce que Vercel
// ajoute lui-même par défaut. Volontairement fait ici plutôt que via un
// `proxy.ts` (l'équivalent Next.js 16 de l'ancien middleware) : le projet
// évite délibérément ce fichier partout ailleurs (voir les layouts
// admin/dashboard/commercial/compte, qui font tout leur contrôle d'accès
// eux-mêmes) et un CSP à base de nonce forcerait un rendu 100% dynamique
// (voir la doc Next.js sur le CSP) — changement bien plus lourd que ce
// qu'un simple ajout d'en-têtes statiques justifie.
//
// CSP volontairement avec 'unsafe-inline' sur script-src/style-src plutôt
// que strict par nonce : le site n'a qu'un seul script inline (le JSON-LD
// de app/layout.tsx, jamais alimenté par une donnée utilisateur) et une
// poignée de styles inline calculés à l'exécution (largeur de barre de
// stats, position du tiroir mobile...) — un CSP strict casserait ces
// derniers sans un vrai chantier de refactor. Le gain principal reste
// intact malgré `unsafe-inline` : aucun script ni connexion externe non
// listée ici ne peut s'exécuter ou être contactée (protection contre
// l'injection de scripts tiers), et `frame-ancestors 'none'` bloque tout
// embarquement du site dans une iframe (clickjacking) — plus strict que le
// `X-Frame-Options: SAMEORIGIN` ajouté ci-dessous en repli pour les
// navigateurs plus anciens qui ignorent frame-ancestors.
//
// `https://*.supabase.co` sur img-src/connect-src : mêmes raisons que le
// motif générique déjà utilisé par `images.remotePatterns` ci-dessous —
// les photos vendeur/avatar en `<img>` brut et les appels du client
// Supabase navigateur (`src/lib/supabase/client.ts`) visent ce domaine.
// Pas de `wss:` : aucun canal realtime Supabase utilisé dans le projet
// (vérifié par grep sur `.channel(`), donc rien à ajouter pour ça.
const isDev = process.env.NODE_ENV === "development";
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https://*.supabase.co;
  font-src 'self';
  connect-src 'self' https://*.supabase.co;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`
  .replace(/\s{2,}/g, " ")
  .trim();

const nextConfig: NextConfig = {
  // Autorise `next/image` à optimiser les photos hébergées sur Supabase
  // Storage (16/09/2026, enrichissement performance) : jusqu'ici toutes les
  // images uploadées par les vendeurs (produits, logo/couverture boutique,
  // avatar) étaient rendues en `<img>` brut (`ProductImage`, voir
  // decisions-techniques.md), sans redimensionnement responsive ni lazy
  // loading natif. Motif générique `*.supabase.co` plutôt que le nom exact
  // du projet (`NEXT_PUBLIC_SUPABASE_URL`) : évite de dépendre d'une
  // variable d'environnement au moment de la config, robuste si Isaac change
  // un jour de projet Supabase.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
