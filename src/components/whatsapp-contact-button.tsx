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
  label = "Contacter sur WhatsApp",
  variant = "solid",
}: {
  whatsappNumber: string;
  message: string;
  label?: string;
  /** "outline" : bouton secondaire pleine largeur (fiche produit, 13/10/2026),
   * pour laisser « Ajouter au panier » seul en bouton principal. */
  variant?: "solid" | "outline";
}) {
  const href = `https://wa.me/${toWhatsappNumber(whatsappNumber)}?text=${encodeURIComponent(
    message
  )}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={
        variant === "outline"
          ? "flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-ligne bg-white px-4 text-sm font-semibold text-encre transition hover:border-[#25D366] hover:text-[#128C7E]"
          : "inline-flex items-center justify-center gap-1.5 rounded-md bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
      }
    >
      {variant === "outline" ? (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0 text-[#25D366]" fill="currentColor">
          <path d="M12 2.2a9.7 9.7 0 0 0-8.4 14.6L2.2 21.8l5.1-1.3A9.7 9.7 0 1 0 12 2.2Zm0 17.7a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 19.9Zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8.9c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .1-1.2c0-.1-.2-.2-.5-.3Z" />
        </svg>
      ) : null}
      {label}
    </a>
  );
}
