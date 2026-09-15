import type { Metadata, Viewport } from "next";
import { Fraunces, Work_Sans, IBM_Plex_Mono } from "next/font/google";
import { RegisterServiceWorker } from "@/components/register-service-worker";
import "./globals.css";

// Typographie KEVA (14/09/2026, voir decisions-techniques.md et la charte
// graphique publiée) : Fraunces en display (titres), Work Sans en interface
// (corps de texte, formulaires), IBM Plex Mono pour les données chiffrées
// (prix, codes de commande). Chargées via next/font/google — auto-hébergées
// par Next.js au build, donc aucune dépendance réseau à l'exécution ni de
// clé à gérer. Exposées en variables CSS, reprises dans globals.css (@theme).
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
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

export const metadata: Metadata = {
  title: "KEVA — créez votre boutique en ligne en 5 minutes",
  description:
    "Créez votre boutique en ligne, partagez votre lien et recevez vos commandes avec paiement Mobile Money.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KEVA",
  },
};

export const viewport: Viewport = {
  themeColor: "#0e3b2c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="fr"
      className={`h-full antialiased ${fraunces.variable} ${workSans.variable} ${plexMono.variable}`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
