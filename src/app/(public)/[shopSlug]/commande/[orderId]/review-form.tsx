"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Formulaire d'avis client, sur la page de confirmation/reçu de commande
 * (voir migration 0011, submit_product_review, pour le choix de rattacher
 * l'avis à la commande plutôt qu'à un compte client — qui n'existe pas côté
 * boutique publique).
 */
export function ReviewForm({
  orderId,
  productId,
  productTitle,
}: {
  orderId: string;
  productId: string;
  productTitle: string;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "done" | "error">("idle");

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
      <p className="text-sm text-green-600">
        Merci pour ton avis sur « {productTitle} » !
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-md border border-gray-100 p-3"
    >
      <p className="text-sm font-medium text-gray-700">{productTitle}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
            className={`text-lg leading-none ${n <= rating ? "text-yellow-500" : "text-gray-300"}`}
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
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      {status === "error" && (
        <p className="text-xs text-red-600">
          {rating < 1 ? "Choisis une note avant d'envoyer." : "Échec de l'envoi. Réessaie."}
        </p>
      )}
      <button
        type="submit"
        disabled={status === "pending"}
        className="w-fit rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
      >
        {status === "pending" ? "Envoi..." : "Envoyer mon avis"}
      </button>
    </form>
  );
}
