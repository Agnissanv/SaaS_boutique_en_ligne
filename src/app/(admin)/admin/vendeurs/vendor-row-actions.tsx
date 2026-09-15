"use client";

import { useState, useTransition } from "react";
import { toggleShopStatus, updateAdminNotes } from "./actions";

export function VendorRowActions({
  shopId,
  status,
  adminNotes,
}: {
  shopId: string;
  status: string;
  adminNotes: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState(adminNotes ?? "");
  const [notesSaved, setNotesSaved] = useState(true);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(() => {
            toggleShopStatus(shopId, status === "active" ? "suspended" : "active");
          })
        }
        className={`w-fit rounded-md border px-3 py-1 text-xs font-medium disabled:opacity-50 ${
          status === "active"
            ? "border-erreur/40 text-erreur hover:bg-erreur/10"
            : "border-succes/40 text-succes hover:bg-succes/10"
        }`}
      >
        {status === "active" ? "Suspendre" : "Réactiver"}
      </button>

      <textarea
        rows={2}
        value={notes}
        placeholder="Note admin (visible uniquement ici)..."
        onChange={(e) => {
          setNotes(e.target.value);
          setNotesSaved(false);
        }}
        onBlur={() => {
          if (notesSaved) return;
          startTransition(() => {
            updateAdminNotes(shopId, notes);
            setNotesSaved(true);
          });
        }}
        className="w-56 rounded-md border border-ligne px-2 py-1 text-xs focus:ring-2 focus:ring-vert-actif"
      />
    </div>
  );
}
