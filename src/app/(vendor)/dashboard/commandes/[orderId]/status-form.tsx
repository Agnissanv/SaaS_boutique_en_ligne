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

// Messages pré-remplis pour le bouton "Prévenir sur WhatsApp" — complément
// à l'email automatique (voir order-notifications.ts) : un client sans
// email fourni, ou qui ne regarde que WhatsApp, reste prévenu en un clic
// côté vendeur plutôt que pas du tout. Voir "Notifications client
// automatiques" dans decisions-techniques.md.
const WHATSAPP_STATUS_MESSAGES: Partial<Record<string, string>> = {
  paid: "ta commande a été confirmée.",
  preparing: "ta commande est en cours de préparation.",
  delivered: "ta commande a été livrée. N'hésite pas à laisser un avis !",
  cancelled: "ta commande a malheureusement été annulée.",
};

/** "+225 07 00 00 00 00" -> "22507000000" (format attendu par wa.me) */
function toWhatsappNumber(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

export function StatusForm({
  orderId,
  currentStatus,
  customerName,
  customerPhone,
  shopName,
}: {
  orderId: string;
  currentStatus: string;
  customerName: string;
  customerPhone: string;
  shopName: string;
}) {
  const [isPending, startTransition] = useTransition();

  const whatsappMessage = WHATSAPP_STATUS_MESSAGES[currentStatus];
  const whatsappHref = whatsappMessage
    ? `https://wa.me/${toWhatsappNumber(customerPhone)}?text=${encodeURIComponent(
        `Bonjour ${customerName}, ${whatsappMessage} (${shopName})`
      )}`
    : null;

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
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

      {whatsappHref && (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white"
        >
          Prévenir sur WhatsApp
        </a>
      )}
    </div>
  );
}
