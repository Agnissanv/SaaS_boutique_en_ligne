import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Exclut les assets statiques et l'optimisation d'images Next.js
     * pour ne pas rafraîchir la session inutilement sur ces requêtes.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)",
  ],
};
