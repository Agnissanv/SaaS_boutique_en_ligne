import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  PARTNER_COOKIE,
  PARTNER_COOKIE_MAX_AGE,
  normalizePartnerCode,
  normalizePartnerSource,
  parsePartnerCookie,
  serializePartnerCookie,
} from "@/lib/partners";

/**
 * Lien d'une partenaire : `/p/<code>` (lien général) ou `/p/<code>/<réseau>`
 * (tiktok, instagram, facebook). Mène TOUJOURS à la création de boutique —
 * c'est son rôle : elle gagne sur les boutiques créées — même si le code est
 * inconnu ou le partenariat terminé (une ancienne vidéo ne tombe jamais sur
 * une erreur ; simplement, plus rien n'est attribué).
 *
 * Mémorise le code 30 jours (cookie `keva_partner`) : le visiteur peut se
 * promener sur le site avant de s'inscrire. Le premier lien suivi l'emporte,
 * sauf s'il appartient à un partenariat terminé. Le cookie n'est pas
 * httpOnly : un code saisi à la main avant une inscription Google est écrit
 * côté navigateur sous le même nom (rien de sensible dedans).
 *
 * Un clic n'est compté qu'au premier passage de ce navigateur pour cette
 * partenaire, et l'enregistrement passe par le serveur (clé service role,
 * limite de débit) : impossible de gonfler ses statistiques en appelant la
 * base directement.
 */
export async function handlePartnerLink(
  request: NextRequest,
  rawCode: string,
  rawSource?: string
): Promise<NextResponse> {
  const target = new URL("/inscription", request.url);
  const code = normalizePartnerCode(decodeURIComponent(rawCode));
  if (!code) return NextResponse.redirect(target);
  const source = normalizePartnerSource(rawSource?.toLowerCase());

  const supabase = createServiceRoleClient();
  const existing = parsePartnerCookie(request.cookies.get(PARTNER_COOKIE)?.value);

  const allowed = await checkRateLimit("partner_click", getClientIp(request.headers), {
    maxAttempts: 30,
    windowMinutes: 1,
  });
  const { data: currentCode } = await supabase.rpc("record_partner_click", {
    p_code: code,
    p_source: source,
    p_count: allowed && existing?.code !== code,
  });
  if (!currentCode) return NextResponse.redirect(target);

  // Un autre lien a été suivi avant : il garde la main s'il est encore actif.
  let keepExisting = false;
  if (existing && existing.code !== currentCode) {
    const { data: existingCode } = await supabase.rpc("record_partner_click", {
      p_code: existing.code,
      p_source: existing.source,
      p_count: false,
    });
    keepExisting = Boolean(existingCode);
  }

  if (!keepExisting) {
    target.searchParams.set("partenaire", currentCode);
    target.searchParams.set("canal", source);
  }
  const response = NextResponse.redirect(target);
  if (!keepExisting && existing?.code !== currentCode) {
    response.cookies.set(PARTNER_COOKIE, serializePartnerCookie(currentCode, source), {
      maxAge: PARTNER_COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  return response;
}
