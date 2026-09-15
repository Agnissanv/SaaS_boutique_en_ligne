"use client";

import { useTransition } from "react";
import { updateOrderStatus } from "../actions";
import { toWhatsappNumber } from "@/lib/utils/whatsapp";
import { NativeSelect } from "@/components/native-select";

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
      <label htmlFor="status" className="text-sm font-medium text-encre">
        Statut
      </label>
      {/* `<select>` remplacé le 15/09/2026 par `NativeSelect` (chantier
          "langage natif", dashboard vendeur) — même comportement contrôlé,
          `onChange` reçoit directement la valeur choisie. */}
      <NativeSelect
        id="status"
        label="Statut de la commande"
        value={currentStatus}
        disabled={isPending}
        onChange={(next) =>
          startTransition(() => {
            updateOrderStatus(orderId, next);
          })
        }
        options={STATUSES}
      />

      {/* Vert WhatsApp officiel conservé volontairement, cf. page.tsx. */}
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
