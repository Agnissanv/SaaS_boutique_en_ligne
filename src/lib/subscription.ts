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

export type ShopSubscriptionInfo = {
  state: SubscriptionState;
  planName: string | null;
  planCode: string | null;
  expiresAt: string | null;
  /** Date à partir de laquelle le blocage réel s'applique (fin de la période de grâce). */
  graceEndsAt: string | null;
};

type SubscriptionRow = {
  expires_at: string;
  plan: { code: string; name: string } | { code: string; name: string }[] | null;
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
    .select("expires_at, plan:subscription_plans(code, name)")
    .eq("shop_id", shopId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = data as SubscriptionRow | null;

  if (!row) {
    return { state: "none", planName: null, planCode: null, expiresAt: null, graceEndsAt: null };
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
  };
}
