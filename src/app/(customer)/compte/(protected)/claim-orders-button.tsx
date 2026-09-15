"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Rattache au compte les commandes passées en invité (avant la création du
 * compte, ou passées entre-temps sans être connecté) — voir
 * claim_guest_orders() dans la migration 0014 : correspondance par numéro de
 * téléphone normalisé, comparé au téléphone du profil.
 *
 * Bouton manuel plutôt qu'automatique à chaque visite : plus prévisible pour
 * l'utilisateur (il sait quand ça s'est déclenché), et évite un aller-retour
 * RPC silencieux sur chaque chargement de /compte. Lancé une fois
 * automatiquement juste après l'inscription (voir inscription-form.tsx) —
 * ce bouton sert surtout à relancer le rattachement si le téléphone du
 * profil a été renseigné/modifié après coup.
 */
export function ClaimOrdersButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setMessage(null);

    const supabase = createClient();
    const { data, error } = await supabase.rpc("claim_guest_orders");

    setPending(false);

    if (error) {
      setMessage("Impossible de vérifier tes anciennes commandes pour le moment.");
      return;
    }

    const count = typeof data === "number" ? data : 0;
    setMessage(
      count > 0
        ? `${count} commande${count > 1 ? "s" : ""} retrouvée${count > 1 ? "s" : ""} et ajoutée${count > 1 ? "s" : ""} à ton compte.`
        : "Aucune commande supplémentaire trouvée avec le numéro de ton profil."
    );

    if (count > 0) {
      router.refresh();
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-md border border-ligne px-3 py-1.5 text-xs font-medium text-encre hover:bg-brume disabled:opacity-50"
      >
        {pending ? "Recherche..." : "Rattacher mes anciennes commandes"}
      </button>
      {message && <p className="mt-1 text-xs text-encre/60">{message}</p>}
    </div>
  );
}
