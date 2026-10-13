/**
 * Statut lisible d'un partenaire pour l'admin, calculé à partir des dates
 * (même règle que `partner_is_active` en base : actif si invitation
 * acceptée, commencé, et pas encore à la date de fin).
 */
export type PartnerStatusInput = {
  accepted_at: string | null;
  invite_expires_at: string | null;
  starts_on: string;
  ends_on: string | null;
};

export function partnerStatus(partner: PartnerStatusInput): {
  label: string;
  tone: "success" | "warning" | "muted";
  active: boolean;
} {
  const today = new Date().toISOString().slice(0, 10);
  const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR");
  if (!partner.accepted_at) {
    const expired = !partner.invite_expires_at || partner.invite_expires_at < new Date().toISOString();
    return expired
      ? { label: "Invitation expirée", tone: "muted", active: false }
      : { label: "Invitation envoyée", tone: "warning", active: false };
  }
  if (partner.ends_on && partner.ends_on <= today) return { label: "Terminé", tone: "muted", active: false };
  if (partner.starts_on > today) return { label: `Commence le ${day(partner.starts_on)}`, tone: "warning", active: false };
  if (partner.ends_on) return { label: `Fin le ${day(partner.ends_on)}`, tone: "warning", active: true };
  return { label: "Actif", tone: "success", active: true };
}

export const STATUS_TONE_CLASSES = {
  success: "bg-succes/15 text-succes",
  warning: "bg-attention/15 text-attention",
  muted: "bg-brume text-encre/60",
} as const;
