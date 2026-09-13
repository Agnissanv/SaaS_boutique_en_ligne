"use client";

import { useTransition } from "react";
import { updateOrderStatus } from "../actions";

const STATUSES = [
  { value: "pending", label: "En attente" },
  { value: "paid", label: "Payée" },
  { value: "preparing", label: "En préparation" },
  { value: "delivered", label: "Livrée" },
  { value: "cancelled", label: "Annulée" },
];

export function StatusForm({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mt-6 flex items-center gap-2">
      <label htmlFor="status" className="text-sm font-medium text-gray-700">
        Statut
      </label>
      <select
        id="status"
        defaultValue={currentStatus}
        disabled={isPending}
        onChange={(e) =>
          startTransition(() => {
            updateOrderStatus(orderId, e.target.value);
          })
        }
        className="rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
