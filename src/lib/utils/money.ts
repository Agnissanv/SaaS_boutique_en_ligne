const FCFA_FORMAT = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/**
 * Montant en francs CFA avec séparateur de milliers : « 380 000 FCFA »
 * (13/10/2026, audit visuel : une cinquantaine d'endroits affichaient
 * « 380000 FCFA » à côté d'autres déjà formatés).
 */
export function fcfa(amount: number | string | null | undefined): string {
  return `${FCFA_FORMAT.format(Number(amount ?? 0))} FCFA`;
}
