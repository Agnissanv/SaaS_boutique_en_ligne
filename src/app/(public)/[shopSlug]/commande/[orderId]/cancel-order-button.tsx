"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Bouton d'annulation de commande, sur la page de confirmation/reçu — ajouté
 * le 21/09/2026 (demande d'Isaac : "ajoute le fait que le client puisse
 * annuler sa commande à tout moment... si tu penses que c'est important,
 * fais-le"). Même modèle de confiance que ReviewForm juste à côté : l'UUID
 * de la commande (présent dans l'URL, non devinable) sert de "jeton de
 * capacité", aucune vérification supplémentaire — voir cancel_order,
 * migration 0030.
 *
 * Restriction volontaire (pas demandée mot pour mot par Isaac, décidée ici) :
 * le bouton n'est rendu par la page parente que pour les statuts pending /
 * paid / preparing — rien à annuler une fois livré, pas de double-annulation
 * une fois déjà annulé. cancel_order refuse aussi ces deux cas côté serveur
 * (défense en profondeur si la page affichée est périmée).
 *
 * Double-clic requis (bouton -> confirmation inline) pour éviter une
 * annulation accidentelle, vu que l'action est irréversible dans l'UI
 * actuelle (aucun "dé-annuler").
 */
export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<"idle" | "pending" | "error">("idle");

  async function handleCancel() {
    setStatus("pending");
    const supabase = createClient();
    const { error } = await supabase.rpc("cancel_order", { p_order_id: orderId });

    if (error) {
      setStatus("error");
      return;
    }

    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm text-erreur underline underline-offset-2 hover:text-erreur/80"
      >
        Annuler ma commande
      </button>
    );
  }

  return (
    <div className="rounded-md border border-erreur/30 bg-erreur/5 p-3">
      <p className="text-sm text-encre">
        Confirmer l&apos;annulation de cette commande ? C&apos;est
        définitif, le vendeur en sera informé.
      </p>
      {status === "error" && (
        <p className="mt-2 text-xs text-erreur">
          Échec de l&apos;annulation. Réessaie dans un instant.
        </p>
      )}
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={handleCancel}
          disabled={status === "pending"}
          className="rounded-md bg-erreur px-3 py-1.5 text-xs font-medium text-ivoire hover:bg-erreur/90 disabled:opacity-50"
        >
          {status === "pending" ? "Annulation..." : "Oui, annuler"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={status === "pending"}
          className="rounded-md border border-ligne px-3 py-1.5 text-xs font-medium text-encre hover:bg-brume disabled:opacity-50"
        >
          Non, garder ma commande
        </button>
      </div>
    </div>
  );
}
