import { InscriptionForm } from "./inscription-form";

// Rendu dynamique forcé : cohérent avec /connexion (voir ce fichier pour la
// raison — évite une pré-génération statique qui exigerait des clés Supabase
// valides au build).
export const dynamic = "force-dynamic";

export default function InscriptionPage() {
  return <InscriptionForm />;
}
