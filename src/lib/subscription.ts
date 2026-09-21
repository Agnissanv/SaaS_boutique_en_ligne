import type { createClient } from "@/lib/supabase/server";

/**
 * Blocage progressif d'abonnement expiré (cahier des charges §3.1.A.7),
 * ajouté le 13/09/2026 à la demande d'Isaac.
 *
 * L'état de l'abonnement est calculé à la volée à partir de
 * `subscriptions.expires_at`, PAS lu depuis la colonne `subscriptions.status`
 * : cette colonne n'est écrite qu'à la création/au renouvellement (par
 * `start_free_subscription` ou `assignPlan` côté admin) et ne serait jamais
 * mise à jour ensuite sans job planifié — et ce projet n'a volontairement
 * aucune tâche async/cron pour l'instant (voir decisions-techniques.md,
 * "Files d'attente / tâches async reportées"). Calculer l'état à la demande
 * évite d'avoir besoin d'un tel job tout en restant toujours exact.
 *
 * Période de grâce : le vendeur garde un accès complet quelques jours après
 * la date d'expiration, pour ne pas couper brutalement l'accès à quelqu'un
 * qui est simplement en train de renouveler (pas de paiement automatique
 * CinetPay tant que le compte marchand n'est pas validé — le renouvellement
 * passe pour l'instant par un admin qui réassigne un plan manuellement,
 * cf. `/admin/abonnements`).
 */
export const SUBSCRIPTION_GRACE_PERIOD_DAYS = 7;

export type SubscriptionState = "active" | "grace_period" | "expired" | "none";

export const SUBSCRIPTION_STATE_LABELS: Record<SubscriptionState, string> = {
  active: "Actif",
  grace_period: "Période de grâce",
  expired: "Expiré",
  none: "Aucun abonnement",
};

/**
 * Classes de badge KEVA par état d'abonnement (même principe que
 * ORDER_STATUS_BADGE_CLASS dans src/lib/orders.ts — un seul endroit pour
 * couleur + libellé, réutilisé par /admin/abonnements et /dashboard/abonnement).
 * Actif → succès ; période de grâce → attention (accès encore complet mais
 * à surveiller) ; expiré → erreur ; aucun abonnement → neutre.
 */
export const SUBSCRIPTION_STATE_BADGE_CLASS: Record<SubscriptionState, string> = {
  active: "bg-succes/15 text-succes",
  grace_period: "bg-attention/15 text-attention",
  expired: "bg-erreur/15 text-erreur",
  none: "bg-sable text-encre/60",
};

/** Calcule l'état réel à partir d'une seule date d'expiration. Pure — testable sans DB. */
export function computeSubscriptionState(expiresAt: string | null): SubscriptionState {
  if (!expiresAt) return "none";

  const now = Date.now();
  const expiryMs = new Date(expiresAt).getTime();
  const graceEndMs = expiryMs + SUBSCRIPTION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;

  if (now < expiryMs) return "active";
  if (now < graceEndMs) return "grace_period";
  return "expired";
}

/**
 * Feature flags par plan (refonte des abonnements du 15/09/2026, spec finale
 * fournie par Isaac — voir supabase/migrations/0016_subscription_plans_v2.sql
 * pour les valeurs exactes par plan). Un seul endroit de lecture/décodage du
 * jsonb `subscription_plans.features`, réutilisé partout où une fonctionnalité
 * doit être conditionnée au plan — même principe que le reste de ce fichier
 * (un seul point de calcul, pas de logique dupliquée côté vendeur/admin).
 */
export type ShopFeatureFlags = {
  maxProducts: number | null;
  canManageStock: boolean;
  canUseVariants: boolean;
  canUsePromoCodes: boolean;
  canCustomizeBranding: "none" | "basic" | "complete";
  canExportStats: boolean;
  canMultiUser: boolean;
  maxCollaborators: number;
  hasOrderNotifications: boolean;
  hasAdvancedStockAlerts: boolean;
  /**
   * Statistiques avec graphiques (Business+) — ajouté le 16/09/2026, voir
   * `/dashboard/statistiques` : courbe de CA, produits les plus vendus/vus,
   * répartition des commandes par statut. Distinct de `hasFullStats`
   * (Pro uniquement) qui ajoute le taux de conversion et la comparaison de
   * périodes par-dessus ces mêmes graphiques.
   */
  hasAdvancedStats: boolean;
  hasFullStats: boolean;
};

/**
 * Flags les plus restrictifs (équivalents Starter) — appliqués par défaut
 * quand une boutique n'a aucun abonnement (`state === "none"`, cas qui ne
 * devrait plus arriver depuis `start_free_subscription`, mais mieux vaut
 * fermer par défaut que d'ouvrir par erreur une fonctionnalité payante).
 */
export const DEFAULT_FEATURE_FLAGS: ShopFeatureFlags = {
  maxProducts: 2,
  canManageStock: false,
  canUseVariants: false,
  canUsePromoCodes: false,
  canCustomizeBranding: "none",
  canExportStats: false,
  canMultiUser: false,
  maxCollaborators: 0,
  hasOrderNotifications: false,
  hasAdvancedStockAlerts: false,
  hasAdvancedStats: false,
  hasFullStats: false,
};

/**
 * Décode le jsonb `features` d'un plan — tolérant à un champ manquant/mal
 * formé (retombe sur le défaut le plus restrictif plutôt que de planter).
 *
 * `can_remove_branding` retiré du modèle le 16/09/2026 (décision produit
 * d'Isaac : le badge KEVA reste visible sur toutes les boutiques, quel que
 * soit le plan — jamais une fonctionnalité à vendre). Voir
 * supabase/migrations/0019_drop_can_remove_branding.sql, qui retire aussi la
 * clé du jsonb en base pour qu'elle ne puisse pas resurgir par erreur.
 */
function parseFeatureFlags(features: unknown): ShopFeatureFlags {
  const f = (features ?? {}) as Record<string, unknown>;
  return {
    maxProducts:
      typeof f.max_products === "number" || f.max_products === null
        ? (f.max_products as number | null)
        : DEFAULT_FEATURE_FLAGS.maxProducts,
    canManageStock: Boolean(f.can_manage_stock),
    canUseVariants: Boolean(f.can_use_variants),
    canUsePromoCodes: Boolean(f.can_use_promo_codes),
    canCustomizeBranding:
      f.can_customize_branding === "basic" || f.can_customize_branding === "complete"
        ? f.can_customize_branding
        : "none",
    canExportStats: Boolean(f.can_export_stats),
    canMultiUser: Boolean(f.can_multi_user),
    maxCollaborators: typeof f.max_collaborators === "number" ? f.max_collaborators : 0,
    hasOrderNotifications: Boolean(f.has_order_notifications),
    hasAdvancedStockAlerts: Boolean(f.has_advanced_stock_alerts),
    hasAdvancedStats: Boolean(f.has_advanced_stats),
    hasFullStats: Boolean(f.has_full_stats),
  };
}

export type ShopSubscriptionInfo = {
  state: SubscriptionState;
  planName: string | null;
  planCode: string | null;
  expiresAt: string | null;
  /** Date à partir de laquelle le blocage réel s'applique (fin de la période de grâce). */
  graceEndsAt: string | null;
  features: ShopFeatureFlags;
  /**
   * Mois d'essai Pro offert à la création de la boutique (21/09/2026, voir
   * `start_free_subscription` / migration 0029), distinct d'un vrai paiement
   * ou d'une assignation manuelle admin (les deux mettent `is_trial = false`
   * via `applyPlanToShop`) — permet d'avertir le vendeur qu'il s'agit d'un
   * cadeau temporaire plutôt que de le laisser croire à un abonnement payé.
   */
  isTrial: boolean;
};

type SubscriptionRow = {
  expires_at: string;
  is_trial: boolean;
  plan:
    | { code: string; name: string; features: unknown }
    | { code: string; name: string; features: unknown }[]
    | null;
};

/**
 * Récupère l'abonnement le plus récent d'une boutique et calcule son état.
 * Utilisée à la fois côté vendeur (bannière + blocage création produit) et
 * côté admin (affichage du vrai statut dans /admin/abonnements) — un seul
 * endroit pour cette logique.
 */
export async function getShopSubscription(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shopId: string
): Promise<ShopSubscriptionInfo> {
  const { data } = await supabase
    .from("subscriptions")
    .select("expires_at, is_trial, plan:subscription_plans(code, name, features)")
    .eq("shop_id", shopId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = data as SubscriptionRow | null;

  if (!row) {
    return {
      state: "none",
      planName: null,
      planCode: null,
      expiresAt: null,
      graceEndsAt: null,
      features: DEFAULT_FEATURE_FLAGS,
      isTrial: false,
    };
  }

  const plan = Array.isArray(row.plan) ? row.plan[0] : row.plan;
  const expiryMs = new Date(row.expires_at).getTime();
  const graceEndsAt = new Date(
    expiryMs + SUBSCRIPTION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  return {
    state: computeSubscriptionState(row.expires_at),
    planName: plan?.name ?? null,
    planCode: plan?.code ?? null,
    expiresAt: row.expires_at,
    graceEndsAt,
    features: parseFeatureFlags(plan?.features),
    isTrial: row.is_trial,
  };
}

export type ApplyPlanResult = {
  planId: string;
  planCode: string;
  planName: string;
  expiresAt: string;
  /** Produits désactivés automatiquement car en excédent de la nouvelle limite (downgrade) — jamais supprimés. */
  deactivatedProductIds: string[];
};

/**
 * Cœur de l'assignation d'un plan à une boutique — création/mise à jour de
 * `subscriptions` + désactivation des produits en excédent en cas de
 * downgrade (§3 de la spec du 15/09/2026 : "bloquer les produits
 * supplémentaires sans les supprimer"). Extrait le 15/09/2026 pour être
 * appelé depuis DEUX endroits qui ne doivent pas diverger : l'assignation
 * manuelle admin (`/admin/abonnements`, `assignPlan`) ET la confirmation
 * automatique d'un paiement CinetPay réel (`/api/cinetpay/webhook`) —
 * chacun avec son propre contrôle d'accès (rôle admin vs statut de paiement
 * vérifié), mais la même logique de fond une fois l'autorisation acquise.
 *
 * Ne fait AUCUNE vérification d'autorisation elle-même — c'est aux
 * appelants de s'assurer que l'assignation est légitime avant d'appeler
 * cette fonction (rôle admin vérifié, ou paiement confirmé via l'API de
 * vérification CinetPay, jamais sur la seule foi d'un payload de webhook).
 */
export async function applyPlanToShop(
  // Accepte aussi bien le client authentifié (Server Action admin) que le
  // client service role (webhook, hors contexte utilisateur) — les deux
  // exposent la même API `SupabaseClient<Database>` sous le capot.
  supabase: Awaited<ReturnType<typeof createClient>>,
  shopId: string,
  planCode: string
): Promise<ApplyPlanResult | null> {
  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("id, code, name, duration_days, features")
    .eq("code", planCode)
    .maybeSingle();

  if (!plan) return null;

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("shop_id", shopId)
    .maybeSingle();

  const expiresAt = new Date(Date.now() + plan.duration_days * 24 * 60 * 60 * 1000).toISOString();

  if (existing) {
    await supabase
      .from("subscriptions")
      .update({
        plan_id: plan.id,
        status: "active",
        started_at: new Date().toISOString(),
        expires_at: expiresAt,
        // Toute assignation réelle de plan (admin ou paiement CinetPay
        // confirmé) efface le statut d'essai — voir migration 0029.
        is_trial: false,
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("subscriptions").insert({
      shop_id: shopId,
      plan_id: plan.id,
      status: "active",
      started_at: new Date().toISOString(),
      expires_at: expiresAt,
      is_trial: false,
    });
  }

  // Downgrade avec dépassement de la nouvelle limite de produits : les plus
  // anciens (premiers ajoutés) restent actifs, les plus récents en excédent
  // sont désactivés — récupérables à tout moment, jamais supprimés.
  const maxProducts = (plan.features as { max_products?: number | null } | null)?.max_products;
  let deactivatedProductIds: string[] = [];

  if (typeof maxProducts === "number") {
    const { data: activeProducts } = await supabase
      .from("products")
      .select("id")
      .eq("shop_id", shopId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    const excess = (activeProducts ?? []).slice(maxProducts);
    if (excess.length > 0) {
      deactivatedProductIds = excess.map((p) => p.id);
      await supabase
        .from("products")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in("id", deactivatedProductIds);
    }
  }

  return {
    planId: plan.id,
    planCode: plan.code,
    planName: plan.name,
    expiresAt,
    deactivatedProductIds,
  };
}
