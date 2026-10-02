import type { Metadata, Viewport } from "next";
import { Archivo, Work_Sans, IBM_Plex_Mono } from "next/font/google";
import { RegisterServiceWorker } from "@/components/register-service-worker";
import { LocationDetector } from "@/components/location-detector";
import { BottomNav } from "@/components/bottom-nav";
import { ScrollToTopButton } from "@/components/scroll-to-top-button";
import { SiteFooter } from "@/components/site-footer";
import { AdminQuickAccess } from "@/components/admin-quick-access";
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
// "/keva-logo-og.jpg", utilisé en repli boutique/produit sans photo) se
// résolvent en URL absolue — sans ça, Next.js les laisse relatifs et la
// plupart des clients de prévisualisation (WhatsApp, Instagram, Messenger)
// n'affichent alors aucune image. Même variable d'environnement que les
// liens envoyés par email ailleurs dans le projet (ex. `commandes/actions.ts`).
//
// Deux fichiers logo distincts depuis le 23/09/2026 (bug de partage remonté
// par Isaac — voir decisions-techniques.md) : `keva-logo.jpg` est le mark
// carré (utilisé tel quel dans les en-têtes de l'appli, à côté du texte
// "KEVA" déjà affiché séparément, et dans `Organization.logo` ci-dessous, un
// logo carré étant la forme attendue par schema.org) ; `keva-logo-og.jpg` est
// une version large (1200×630, avec le mot "KEVA" inclus dans l'image
// puisque rien d'autre ne l'affiche à côté sur une carte de partage) dédiée
// aux `openGraph.images`/`twitter.images`. Avant cette date, un seul fichier
// carré faisait les deux métiers — d'où des cartes de partage tronquées par
// endroits. Isaac a aussi changé le logo KEVA lui-même le 23/09/2026 (nouveau
// mark "K" en forme de caddie) : les deux fichiers ont été régénérés à cette
// occasion à partir du nouveau logo, en même temps que `public/icons/*`.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Titre/description/OG révisés le 23/09/2026 (audit SEO externe transmis par
// Isaac, vérifié point par point avant d'agir) :
// - L'ancien titre ("créez votre boutique en ligne en 5 minutes") ne parlait
//   qu'aux vendeurs alors que `/` est la marketplace publique — un acheteur
//   qui atterrit dessus depuis Google n'y retrouve pas ce qu'annonce le titre.
//   Nouveau titre pensé pour les deux publics, cohérent avec le H1 réel de la
//   page ("Toutes les boutiques en un seul endroit", src/app/page.tsx).
// - L'ancienne description promettait un "paiement Mobile Money" : faux à ce
//   jour (Wave/Orange Money affichés en gris "bientôt disponible" dans le
//   tunnel de commande, seul le paiement à la livraison est actif tant que
//   PawaPay n'est pas branché — voir `cart-checkout.tsx` et
//   decisions-techniques.md). Corrigé pour refléter l'état réel, reprend la
//   formulation déjà validée du hero ("vendeurs indépendants... paie à la
//   livraison").
// - OG/Twitter title portaient juste "KEVA" (trop court pour un aperçu de
//   partage) — alignés sur le title complet.
//
// Revus une seconde fois le 02/10/2026, à la demande explicite d'Isaac
// (règle de positionnement, voir claude/regles-contenu-marketing.md : tout
// contenu KEVA doit affirmer KEVA comme LA référence, jamais rester
// neutre-descriptif). Le titre/description de `/` sont le texte que Google
// ET les moteurs IA (ChatGPT, Perplexity...) lisent en premier pour définir
// KEVA — c'est le point de plus fort effet de levier du site pour ça (voir
// le chantier GEO du même jour). Passage d'un ton purement descriptif
// ("Marketplace et boutiques en ligne...") à une affirmation appuyée sur un
// fait déjà vrai aujourd'hui, pas une promesse inventée : "0% de commission"
// s'applique aux TROIS formules (Starter/Business/Pro, voir
// promotions-section.tsx et tarifs/page.tsx, confirmé avant d'écrire cette
// ligne) — ce n'est jamais une offre de lancement limitée dans le temps, donc
// une affirmation au présent plutôt qu'un engagement "pour toujours" n'a pas
// besoin d'être formulée comme une promesse à part. Reste dual-public (titre
// garde "marketplace", description garde le parcours acheteur en premier) :
// ne répète pas l'erreur du 23/09/2026 (titre uniquement vendeur).
const title = "KEVA — La marketplace ivoirienne, 0% commission vendeur";
const description =
  "KEVA connecte vendeurs indépendants et clients partout en Côte d'Ivoire : découvre des boutiques et commande sans créer de compte, paie à la livraison. Côté vendeur, 0% de commission sur les ventes, sur toutes les formules — ouvre ta boutique en quelques minutes.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  // `alternates.canonical` ajouté le 23/09/2026 : absent jusqu'ici, ce qui
  // laissait Google deviner l'URL canonique de chaque page (risque de
  // duplication avec d'éventuels paramètres de requête sur la marketplace :
  // `?q=`, `?categorie=`, etc.). Les pages boutique et produit déclarent
  // chacune la leur dans leur propre `generateMetadata` (sinon celle-ci,
  // pointant vers l'accueil, s'appliquerait par héritage à tout le site —
  // vérifié : ni l'une ni l'autre ne définissait `alternates` avant ce jour).
  alternates: { canonical: siteUrl },
  keywords: [
    "boutique en ligne Côte d'Ivoire",
    "marketplace Côte d'Ivoire",
    "créer boutique en ligne gratuit",
    "vendre en ligne Abidjan",
    "paiement à la livraison",
    "KEVA",
  ],
  authors: [{ name: "KEVA" }],
  creator: "KEVA",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  // Valeurs de repli pour les pages qui n'ont pas encore de `generateMetadata`
  // propre — les pages boutique (`[shopSlug]`) et produit
  // (`[shopSlug]/[productSlug]`) déclarent les leurs, qui prennent le dessus
  // (Next.js fusionne les métadonnées de la mise en page vers la page, la
  // page la plus profonde gagnant sur les champs qu'elle redéfinit).
  openGraph: {
    title,
    description,
    siteName: "KEVA",
    images: ["/keva-logo-og.jpg"],
    locale: "fr_CI",
    type: "website",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/keva-logo-og.jpg"],
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

// JSON-LD Organization + WebSite — ajouté le 23/09/2026, absent jusqu'ici
// (aucune balise structurée nulle part sur le site, vérifié). `potentialAction`
// pointe vers le vrai paramètre de recherche de la marketplace (`?q=`, voir
// `src/app/page.tsx`), pas un exemple inventé. Rendu une seule fois ici (pas
// par page boutique/produit, qui restent des `WebPage`/`Product` implicites
// sans schéma dédié pour l'instant — hors périmètre de cet audit SEO).
//
// `description` ajoutée le 02/10/2026 (chantier GEO/positionnement, voir
// `description` de `metadata` ci-dessus pour le même raisonnement) : un
// moteur IA qui lit ce JSON-LD pour savoir "ce qu'est KEVA" doit tomber sur
// la même affirmation que partout ailleurs sur le site, pas sur un objet
// `Organization` muet qui ne dit que le nom et l'URL.
//
// `sameAs` ajouté le même jour : jusqu'ici aucun lien officiel vers un
// réseau social n'était documenté nulle part dans le projet (voir
// site-footer.tsx, qui le disait explicitement en commentaire) — jamais
// d'URL inventée ici. Isaac a transmis le lien de la page Facebook KEVA ce
// jour-là, d'où son ajout à la fois ici (signal d'autorité/GEO) et dans le
// footer (voir site-footer.tsx). URL nettoyée du paramètre `locale`
// (purement d'affichage, pas identifiant) transmis par Isaac.
const FACEBOOK_URL = "https://www.facebook.com/profile.php?id=61594398493285";

function OrganizationJsonLd({ siteUrl }: { siteUrl: string }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "KEVA",
        url: siteUrl,
        logo: `${siteUrl}/keva-logo.jpg`,
        description,
        sameAs: [FACEBOOK_URL],
      },
      {
        "@type": "WebSite",
        name: "KEVA",
        url: siteUrl,
        potentialAction: {
          "@type": "SearchAction",
          target: `${siteUrl}/?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

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
        <OrganizationJsonLd siteUrl={siteUrl} />
        {children}
        {/* Pied de page global (29/09/2026) — rendu une seule fois ici pour
            apparaître sur toutes les pages publiques, jamais construit
            jusque-là (vérifié par grep avant d'ajouter quoi que ce soit) ;
            voir site-footer.tsx. `mt-auto` (sur un `body` déjà `flex
            flex-col`) le pousse en bas de l'écran sur les pages courtes,
            sans l'empêcher de suivre un contenu plus long. */}
        <SiteFooter />
        {/* Barre de navigation basse mobile (chantier responsive design,
            15/09/2026) : rendue une seule fois ici, masquée elle-même sur les
            portails d'authentification et les espaces internes vendeur/admin
            — voir bottom-nav.tsx. */}
        <BottomNav />
        {/* Bouton "remonter en haut" (chantier fluidité, 22/09/2026) — monté
            une seule fois ici pour être disponible sur toutes les pages, voir
            scroll-to-top-button.tsx. */}
        <ScrollToTopButton />
        <RegisterServiceWorker />
        {/* Détection silencieuse de la position pour le tri par proximité de
            la marketplace (01/10/2026) — voir location-detector.tsx. */}
        <LocationDetector />
        {/* Raccourci "Espace admin" sur les pages publiques (01/10/2026,
            retour d'Isaac — voir admin-quick-access.tsx) : se cache tout
            seul pour un visiteur non-admin ou déjà dans /admin. */}
        <AdminQuickAccess />
      </body>
    </html>
  );
}
