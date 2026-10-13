import { cookies } from "next/headers";
import { InscriptionForm } from "./inscription-form";
import {
  PARTNER_COOKIE,
  normalizePartnerCode,
  normalizePartnerSource,
  parsePartnerCookie,
} from "@/lib/partners";

export const dynamic = "force-dynamic";

// Code partenaire pré-rempli (13/10/2026, programme partenaire) : d'abord le
// lien mémorisé 30 jours dans le cookie (le premier lien suivi l'emporte),
// sinon `?partenaire=` ajouté par la route /p/[code] (navigateur qui refuse
// les cookies).
export default async function InscriptionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const fromCookie = parsePartnerCookie(cookieStore.get(PARTNER_COOKIE)?.value);
  const paramCode = normalizePartnerCode(typeof params.partenaire === "string" ? params.partenaire : null);
  const partnerPrefill =
    fromCookie ??
    (paramCode
      ? { code: paramCode, source: normalizePartnerSource(typeof params.canal === "string" ? params.canal : null) }
      : null);

  return <InscriptionForm partnerPrefill={partnerPrefill} />;
}
