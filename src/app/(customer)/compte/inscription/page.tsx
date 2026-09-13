import { InscriptionClientForm } from "./inscription-form";

// Rendu dynamique forcé : même raison que /inscription (portail vendeur).
export const dynamic = "force-dynamic";

export default function InscriptionCompteePage() {
  return <InscriptionClientForm />;
}
