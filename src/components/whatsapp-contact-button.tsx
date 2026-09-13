import { toWhatsappNumber } from "@/lib/utils/whatsapp";

/**
 * Bouton "Contacter sur WhatsApp" — affiché sur la page boutique et la page
 * produit quand le vendeur a renseigné un numéro (shops.whatsapp_number,
 * migration 0013). Ajouté le 15/09/2026 : le cahier des charges §2.1 cible
 * des vendeurs qui vivent sur WhatsApp/Instagram, mais jusqu'ici un client
 * ne pouvait contacter le vendeur qu'en passant réellement commande — aucun
 * moyen de poser une question avant (taille disponible, délai de
 * livraison...). Server Component (pas de state, pas besoin de "use client")
 * contrairement à WhatsappShareButton qui a besoin de `window.location`.
 */
export function WhatsappContactButton({
  whatsappNumber,
  message,
}: {
  whatsappNumber: string;
  message: string;
}) {
  const href = `https://wa.me/${toWhatsappNumber(whatsappNumber)}?text=${encodeURIComponent(
    message
  )}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white"
    >
      Contacter sur WhatsApp
    </a>
  );
}
