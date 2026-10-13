import type { NextRequest } from "next/server";
import { handlePartnerLink } from "@/lib/partner-link";

// Lien d'une partenaire pour un réseau (ex. /p/DJANDJOU/tiktok) — voir src/lib/partner-link.ts.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; source: string }> }
) {
  const { code, source } = await params;
  return handlePartnerLink(request, code, source);
}
