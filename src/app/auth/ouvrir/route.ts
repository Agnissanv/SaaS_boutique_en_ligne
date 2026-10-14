import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readSpacePreference, resolveHomePath } from "@/lib/auth-constants";

/**
 * Ouverture de l'appli installée (`start_url` de public/manifest.json) —
 * 13/10/2026, installation guidée. Avant, l'icône KEVA ouvrait toujours la
 * marketplace, y compris pour un vendeur, qui devait ensuite chercher son
 * tableau de bord. Maintenant chacun arrive dans son espace, avec la même
 * règle qu'à la connexion (`resolveHomePath`) : vendeur -> tableau de bord,
 * partenaire -> espace partenaire, admin, commercial... Un client (ou un
 * visiteur non connecté) arrive sur la marketplace plutôt que sur la page
 * « Mon compte ».
 *
 * Sous /auth (déjà réservé) : aucun risque de collision avec le nom d'une
 * boutique (voir reserved-slugs.ts).
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let destination = "/";
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const home = await resolveHomePath(
      supabase,
      user.id,
      profile?.role,
      readSpacePreference(request.headers.get("cookie"))
    );
    if (home !== "/compte") destination = home;
  }

  return NextResponse.redirect(new URL(destination, request.url));
}
