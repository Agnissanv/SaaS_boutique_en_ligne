import type { NextConfig } from "next";

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
};

export default nextConfig;
