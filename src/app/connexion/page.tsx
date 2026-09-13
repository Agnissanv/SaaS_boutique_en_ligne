import { Suspense } from "react";
import { ConnexionForm } from "./connexion-form";

// Rendu dynamique forcé : évite que Next.js tente de pré-générer cette page
// statiquement au build (ce qui exigerait des clés Supabase valides même en
// l'absence de `.env.local` rempli — inutile pour une page de connexion).
// Doit être exporté depuis un Server Component ("use client" l'interdit).
export const dynamic = "force-dynamic";

export default function ConnexionPage() {
  return (
    // ConnexionForm lit useSearchParams() (paramètre ?erreur= renvoyé par
    // /auth/callback) — Next.js recommande un Suspense autour de tout
    // composant client qui l'utilise.
    <Suspense fallback={null}>
      <ConnexionForm />
    </Suspense>
  );
}
