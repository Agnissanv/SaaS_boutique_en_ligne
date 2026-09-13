import { Suspense } from "react";
import { ConnexionClientForm } from "./connexion-form";

// Rendu dynamique forcé : même raison que /connexion (portail vendeur) — évite
// une pré-génération statique qui exigerait des clés Supabase valides au build.
export const dynamic = "force-dynamic";

export default function ConnexionCompteePage() {
  return (
    <Suspense fallback={null}>
      <ConnexionClientForm />
    </Suspense>
  );
}
