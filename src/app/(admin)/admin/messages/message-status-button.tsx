"use client";

import { useTransition } from "react";
import { CheckCircleIcon, PauseCircleIcon } from "@/components/admin/admin-icons";
import { setContactMessageStatus } from "./actions";

/** Même style de bouton que `VendorRowActions` (suspendre/réactiver une
 * boutique) — cohérence visuelle du back-office plutôt qu'un nouveau
 * composant de bouton pour ce seul cas. */
export function MessageStatusButton({ messageId, status }: { messageId: string; status: string }) {
  const [isPending, startTransition] = useTransition();
  const isHandled = status === "handled";

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(() => {
          setContactMessageStatus(messageId, isHandled ? "new" : "handled");
        })
      }
      className={`flex w-fit shrink-0 items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-medium disabled:opacity-50 ${
        isHandled
          ? "border-ligne text-encre/60 hover:bg-brume"
          : "border-succes/40 text-succes hover:bg-succes/10"
      }`}
    >
      {isHandled ? <PauseCircleIcon className="h-3.5 w-3.5" /> : <CheckCircleIcon className="h-3.5 w-3.5" />}
      {isHandled ? "Rouvrir" : "Marquer traité"}
    </button>
  );
}
