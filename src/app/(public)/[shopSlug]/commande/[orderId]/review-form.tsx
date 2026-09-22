"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Formulaire d'avis client, sur la page de confirmation/reçu de commande
 * (voir migration 0011, submit_product_review, pour le choix de rattacher
 * l'avis à la commande plutôt qu'à un compte client — qui n'existe pas côté
 * boutique publique).
 *
 * Recolorée en charte KEVA le 15/09/2026 (côté client) — pure recolor. Les
 * étoiles utilisent le vert-actif plutôt qu'un jaune générique.
 *
 * `initialRating`/`initialComment` ajoutés le 22/09/2026 (audit pré-lancement) :
 * `submit_product_review` accepte déjà un ré-envoi (upsert, voir migration
 * 0011) mais le formulaire repartait toujours vierge, donnant l'impression
 * qu'aucun avis n'existait — un client revenant modifier son avis risquait
 * de l'effacer par erreur en renvoyant un formulaire vide.
 */
export function ReviewForm({
  orderId,
  productId,
  productTitle,
  initialRating = null,
  initialComment = null,
}: {
  orderId: string;
  productId: string;
  productTitle: string;
  initialRating?: number | null;
  initialComment?: string | null;
}) {
  const [rating, setRating] = useState(initialRating ?? 0);
  const [comment, setComment] = useState(initialComment ?? "");
  const [status, setStatus] = useState<"idle" | "pending" | "done" | "error">("idle");
  const isEditing = initialRating != null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      setStatus("error");
      return;
    }
    setStatus("pending");
    const supabase = createClient();
    const { error } = await supabase.rpc("submit_product_review", {
      p_order_id: orderId,
      p_product_id: productId,
      p_rating: rating,
      p_comment: comment || null,
    });
    setStatus(error ? "error" : "done");
  }

  if (status === "done") {
    return (
      <p className="text-sm text-succes">
        Merci pour ton avis sur « {productTitle} » !
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-md border border-ligne bg-white p-3"
    >
      <p className="text-sm font-medium text-encre">
        {productTitle}
        {isEditing && (
          <span className="ml-2 text-xs font-normal text-encre/40">
            (avis déjà envoyé — modifiable)
          </span>
        )}
      </p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
            className={`text-lg leading-none ${n <= rating ? "text-vert-actif" : "text-encre/20"}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        rows={2}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Ton commentaire (optionnel)"
        maxLength={500}
        className="rounded-md border border-ligne px-3 py-2 text-sm focus:border-vert-actif focus:outline-none"
      />
      {status === "error" && (
        <p className="text-xs text-erreur">
          {rating < 1 ? "Choisis une note avant d'envoyer." : "Échec de l'envoi. Réessaie."}
        </p>
      )}
      <button
        type="submit"
        disabled={status === "pending"}
        className="w-fit rounded-md bg-vert-actif px-3 py-1.5 text-xs font-medium text-ivoire hover:bg-vert-sapin disabled:opacity-50"
      >
        {status === "pending" ? "Envoi..." : isEditing ? "Mettre à jour mon avis" : "Envoyer mon avis"}
      </button>
    </form>
  );
}
