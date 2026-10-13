import type { Metadata } from "next";
import { InscriptionClientForm } from "./inscription-form";

// Rendu dynamique forcé : même raison que /inscription (portail vendeur).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Créer mon compte client — KEVA",
  alternates: { canonical: "/compte/inscription" },
  robots: { index: false, follow: true },
};

export default function InscriptionCompteePage() {
  return <InscriptionClientForm />;
}
