import type { NextRequest } from "next/server";
import { handlePartnerLink } from "@/lib/partner-link";

// Lien général d'une partenaire (ex. /p/DJANDJOU) — voir src/lib/partner-link.ts.
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return handlePartnerLink(request, code);
}
