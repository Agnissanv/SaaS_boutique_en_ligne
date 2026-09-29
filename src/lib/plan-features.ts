/**
 * Mise en forme lisible des `features` (jsonb en base, forme libre) d'un
 * plan d'abonnement — extrait le 29/09/2026 de `dashboard/abonnement/
 * page.tsx` (où cette logique vivait seule jusqu'ici) pour être réutilisée
 * telle quelle par la nouvelle page publique `/tarifs` (voir ce fichier) :
 * un seul endroit qui connaît le libellé français de chaque clé, comme le
 * reste des tables de libellés du projet (`ORDER_STATUS_BADGE_CLASS`,
 * `SUBSCRIPTION_STATE_LABELS`...). Le vendeur connecté (page abonnement) et
 * le visiteur non connecté (page tarifs) doivent voir exactement les mêmes
 * intitulés pour les mêmes plans — dupliquer cette table aurait fini par
 * diverger silencieusement.
 */

/**
 * Libellés lisibles pour les clés connues de `features`. Une clé absente de
 * cette table retombe sur un libellé généré (préfixe can_/has_ retiré,
 * underscores → espaces) plutôt que de planter, au cas où un nouveau flag
 * serait ajouté en base sans être documenté ici.
 */
const FEATURE_LABELS: Record<string, string> = {
  can_multi_user: "Multi-utilisateurs",
  can_export_stats: "Export des statistiques",
  can_manage_stock: "Gestion du stock",
  can_use_variants: "Variantes produits (taille, couleur...)",
  can_use_promo_codes: "Codes promo",
  has_order_notifications: "Notifications de commande",
  has_advanced_stock_alerts: "Alertes de stock avancées",
  has_advanced_stats: "Statistiques avec graphiques",
  has_full_stats: "Statistiques complètes (conversion, comparaisons)",
  // Badge affiché sur la marketplace publique (carte produit, carte
  // boutique, fiche boutique) — voir migration 0042 et VerifiedBadge.
  has_verified_badge: "Badge « Boutique vérifiée » sur la marketplace",
  // Pas de "can_remove_branding" ici : retiré du modèle le 16/09/2026, le
  // badge KEVA reste visible sur toutes les boutiques quel que soit le plan
  // (voir supabase/migrations/0019_drop_can_remove_branding.sql).
};

function humanizeKey(key: string) {
  return key.replace(/^can_|^has_/, "").replace(/_/g, " ");
}

/**
 * Met en forme une seule entrée de `features` — jamais la clé brute. Renvoie
 * `null` quand la valeur ne représente pas un avantage à afficher (booléen à
 * `false`, 0 collaborateur, personnalisation "none"...).
 */
function formatFeature(key: string, value: unknown): string | null {
  if (key === "max_products") {
    return value === null || value === undefined
      ? "Produits illimités"
      : `${value} produits max`;
  }
  if (key === "max_collaborators") {
    const n = Number(value);
    if (!n) return null;
    return `${n} collaborateur${n > 1 ? "s" : ""}`;
  }
  if (key === "can_customize_branding") {
    if (value === "complete") return "Personnalisation complète de la marque";
    if (value === "basic") return "Personnalisation basique de la marque";
    return null; // "none" — pas un avantage à afficher
  }
  if (typeof value === "boolean") {
    return value ? (FEATURE_LABELS[key] ?? humanizeKey(key)) : null;
  }
  return `${FEATURE_LABELS[key] ?? humanizeKey(key)} : ${value}`;
}

/**
 * Transforme le jsonb `features` d'un plan en liste de phrases lisibles,
 * prêtes à afficher en liste à puces. Jamais les clés brutes de la base
 * (`can_manage_stock`, `max_products : null`...) — voir l'historique du bug
 * correspondant, corrigé le 16/09/2026 côté `/dashboard/abonnement`.
 */
export function getPlanFeatureList(features: unknown): string[] {
  if (!features) return [];
  if (Array.isArray(features)) return features.map((f) => String(f));
  return Object.entries(features as Record<string, unknown>)
    .map(([key, value]) => formatFeature(key, value))
    .filter((item): item is string => item !== null);
}
