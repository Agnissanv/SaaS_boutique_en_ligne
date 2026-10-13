import type { Metadata } from "next";

// La page Favoris est entièrement côté client (liste lue dans le navigateur) :
// son titre d'onglet est déclaré ici (audit visuel du 13/10/2026).
export const metadata: Metadata = {
  title: "Mes favoris — KEVA",
  alternates: { canonical: "/favoris" },
  robots: { index: false, follow: true },
};

export default function FavorisLayout({ children }: { children: React.ReactNode }) {
  return children;
}
