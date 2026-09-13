/**
 * "+225 07 00 00 00 00" -> "22507000000" (format attendu par wa.me).
 *
 * Extrait le 15/09/2026 en ajoutant le contact WhatsApp boutique
 * (src/components/whatsapp-contact-button.tsx) : la même fonction était
 * déjà dupliquée dans status-form.tsx et commandes/[orderId]/page.tsx —
 * même logique que l'extraction de CATEGORIES (src/lib/categories.ts).
 */
export function toWhatsappNumber(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}
