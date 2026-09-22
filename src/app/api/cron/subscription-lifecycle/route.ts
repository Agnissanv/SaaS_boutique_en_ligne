import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { runSubscriptionLifecycleCheck } from "@/lib/subscription-lifecycle";

/**
 * Tâche planifiée (Vercel Cron, voir vercel.json — une seule exécution par
 * jour, gratuite sur le plan Hobby à cette fréquence) qui gère le cycle de
 * vie des abonnements expirés : avertissement à l'entrée en période de
 * grâce, puis rétrogradation automatique vers Starter une fois la grâce
 * écoulée. Voir subscription-lifecycle.ts pour le détail et le pourquoi.
 *
 * Protégée par `CRON_SECRET` : Vercel ajoute automatiquement l'en-tête
 * `Authorization: Bearer <CRON_SECRET>` sur les appels qu'il déclenche
 * lui-même dès que cette variable d'env existe — donc, comme le webhook
 * CinetPay (règle d'or : ne jamais faire confiance à un appel entrant sans
 * le vérifier), on la revérifie ici plutôt que de supposer que seul Vercel
 * peut atteindre cette URL publique.
 *
 * `createServiceRoleClient` : pas de session utilisateur ici (déclenché par
 * Vercel, pas par un vendeur), même choix que le webhook CinetPay — bypass
 * RLS nécessaire pour lire/modifier n'importe quelle boutique.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const summary = await runSubscriptionLifecycleCheck(supabase);

  if (summary.errors.length > 0) {
    console.error("subscription-lifecycle cron — erreurs:", summary.errors);
  }

  return NextResponse.json(summary);
}
