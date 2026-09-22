import type { Metadata, Viewport } from "next";
import { Archivo, Work_Sans, IBM_Plex_Mono } from "next/font/google";
import { RegisterServiceWorker } from "@/components/register-service-worker";
import { BottomNav } from "@/components/bottom-nav";
import "./globals.css";

// Typographie KEVA — révisée le 22/09/2026 (voir decisions-techniques.md,
// section "Refonte visuelle" : Isaac a signalé que Fraunces, une serif, ne
// correspondait pas à la police bâton/grasse du logo réel). Fraunces
// remplacée par Archivo (grotesque, va jusqu'au poids 900) en display
// (titres, logo texte), Work Sans conservée en interface (corps de texte,
// formulaires), IBM Plex Mono pour les données chiffrées (prix, codes de
// commande). Chargées via next/font/google — auto-hébergées par Next.js au
// build, donc aucune dépendance réseau à l'exécution ni de clé à gérer.
// Exposées en variables CSS, reprises dans globals.css (@theme).
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  variable: "--font-archivo",
  display: "swap",
});
const workSans = Work_Sans({
  subsets: ["latin"],
  variable: "--font-work-sans",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

// `metadataBase` (16/09/2026, enrichissement partage social) : nécessaire
// pour que les `openGraph.images` déclarés avec un chemin relatif (ex.
// "/keva-logo.jpg", utilisé en repli boutique/produit sans photo) se
// résolvent en URL absolue — sans ça, Next.js les laisse relatifs et la
// plupart des clients de prévisualisation (WhatsApp, Instagram, Messenger)
// n'affichent alors aucune image. Même variable d'environnement que les
// liens envoyés par email ailleurs dans le projet (ex. `commandes/actions.ts`).
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "KEVA — créez votre boutique en ligne en 5 minutes",
  description:
    "Créez votre boutique en ligne, partagez votre lien et recevez vos commandes avec paiement Mobile Money.",
  // Valeurs de repli pour les pages qui n'ont pas encore de `generateMetadata`
  // propre — les pages boutique (`[shopSlug]`) et produit
  // (`[shopSlug]/[productSlug]`) déclarent les leurs, qui prennent le dessus
  // (Next.js fusionne les métadonnées de la mise en page vers la page, la
  // page la plus profonde gagnant sur les champs qu'elle redéfinit).
  openGraph: {
    title: "KEVA",
    description:
      "Créez votre boutique en ligne, partagez votre lien et recevez vos commandes avec paiement Mobile Money.",
    siteName: "KEVA",
    images: ["/keva-logo.jpg"],
    locale: "fr_CI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "KEVA",
    description:
      "Créez votre boutique en ligne, partagez votre lien et recevez vos commandes avec paiement Mobile Money.",
    images: ["/keva-logo.jpg"],
  },
  manifest: "/manifest.json",
  // statusBarStyle "black" plutôt que "default" (blanc) : le bandeau système
  // iOS suit au moins la tonalité sombre de la charte KEVA sans exiger de
  // gérer soi-même le safe-area-inset-top partout ("black-translucent"
  // ferait passer le contenu SOUS la barre système, ce qui demanderait un
  // padding dédié sur chaque écran — reporté à la passe "langage natif" sur
  // la marketplace, iOS restant secondaire par rapport à Android au cahier
  // des charges §4.4). Sur Android, c'est `viewport.themeColor` ci-dessous
  // qui colore la barre système, déjà posé sur le vert sapin de la marque.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
    title: "KEVA",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0e3b2c",
  width: "device-width",
  initialScale: 1,
  // viewportFit "cover" : sans lui, les `env(safe-area-inset-*)` déjà posés
  // sur la barre de navigation basse (`bottom-nav.tsx`) valent toujours 0 —
  // l'app dessinait donc déjà sous l'indicateur d'accueil des iPhone à
  // encoche sans que ce padding n'ait jamais eu d'effet réel. Nécessaire à
  // la fois pour ça et pour l'affichage plein écran en mode PWA installée.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="fr"
      className={`h-full antialiased ${archivo.variable} ${workSans.variable} ${plexMono.variable}`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        {/* Barre de navigation basse mobile (chantier responsive design,
            15/09/2026) : rendue une seule fois ici, masquée elle-même sur les
            portails d'authentification et les espaces internes vendeur/admin
            — voir bottom-nav.tsx. */}
        <BottomNav />
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
