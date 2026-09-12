import type { Metadata, Viewport } from "next";
import { RegisterServiceWorker } from "@/components/register-service-worker";
import "./globals.css";

// Police système neutre en attendant la charte graphique définitive
// (voir decisions-techniques.md — identité visuelle non encore validée).
// À remplacer par next/font une fois la typographie choisie.

export const metadata: Metadata = {
  title: "Boutique — créez votre boutique en ligne en 5 minutes",
  description:
    "Créez votre boutique en ligne, partagez votre lien et recevez vos commandes avec paiement Mobile Money.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Boutique",
  },
};

export const viewport: Viewport = {
  themeColor: "#111827",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
