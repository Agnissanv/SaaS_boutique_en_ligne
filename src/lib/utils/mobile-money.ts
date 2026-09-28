/**
 * Libellés des opérateurs Mobile Money — partagés entre le formulaire "Ma
 * boutique" (shop-form.tsx, choix de l'opérateur) et l'affichage public de
 * la boutique (page.tsx) pour le numéro Mobile Money du vendeur, ajouté le
 * 29/09/2026 (voir migration 0047 et decisions-techniques.md). Un seul
 * endroit pour les 4 valeurs acceptées par la contrainte
 * `shops.mobile_money_operator` — évite qu'un libellé diverge de la valeur
 * réellement stockée en base.
 */
export const MOBILE_MONEY_OPERATORS = ["wave", "orange_money", "mtn_momo", "moov"] as const;

export type MobileMoneyOperator = (typeof MOBILE_MONEY_OPERATORS)[number];

export const MOBILE_MONEY_OPERATOR_LABELS: Record<MobileMoneyOperator, string> = {
  wave: "Wave",
  orange_money: "Orange Money",
  mtn_momo: "MTN Mobile Money",
  moov: "Moov Money",
};

export function isMobileMoneyOperator(value: string): value is MobileMoneyOperator {
  return (MOBILE_MONEY_OPERATORS as readonly string[]).includes(value);
}
