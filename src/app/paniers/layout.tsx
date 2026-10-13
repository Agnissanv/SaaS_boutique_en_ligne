import type { Metadata } from "next";

// Page entièrement côté client (paniers lus dans le navigateur) : son titre
// d'onglet est déclaré ici.
export const metadata: Metadata = {
  title: "Mes paniers — KEVA",
  alternates: { canonical: "/paniers" },
  robots: { index: false, follow: true },
};

export default function PaniersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
