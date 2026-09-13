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
            ? "border-red-300 text-red-700"
            : "border-green-300 text-green-700"
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
        className="w-56 rounded-md border border-gray-300 px-2 py-1 text-xs"
      />
    </div>
  );
}
