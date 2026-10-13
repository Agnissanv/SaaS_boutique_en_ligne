import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { normalizePartnerCode } from "@/lib/partners";

/**
 * Vérifie un code partenaire saisi à la main (inscription, page Abonnement)
 * et renvoie le nom affiché de la partenaire (« Code de Djandjou ✓ »).
 * Seulement pour un partenariat actif. Limité à 30 vérifications par minute
 * et par adresse IP : impossible de deviner la liste des codes en boucle.
 */
export async function GET(request: NextRequest) {
  const code = normalizePartnerCode(request.nextUrl.searchParams.get("c"));
  if (!code) return NextResponse.json({ valid: false });

  const allowed = await checkRateLimit("partner_code_check", getClientIp(request.headers), {
    maxAttempts: 30,
    windowMinutes: 1,
  });
  if (!allowed) return NextResponse.json({ valid: false }, { status: 429 });

  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("partner_codes")
    .select("partner:partners(id, code, display_name)")
    .eq("code", code)
    .maybeSingle();
  const partner = Array.isArray(data?.partner) ? data?.partner[0] : data?.partner;
  if (!partner) return NextResponse.json({ valid: false });

  const { data: active } = await supabase.rpc("partner_is_active", { p_partner_id: partner.id });
  if (!active) return NextResponse.json({ valid: false });

  return NextResponse.json({ valid: true, code: partner.code, name: partner.display_name });
}
