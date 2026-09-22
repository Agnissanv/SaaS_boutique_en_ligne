"use server";

import { sendContactMessageEmail } from "@/lib/email/contact-message";

export type ContactFormState = {
  error?: string;
  success?: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Traite le formulaire "Nous contacter" (page publique /contact, créée le
 * 22/09/2026 — voir decisions-techniques.md, "Nettoyage UX/UI"). Server
 * Action volontairement accessible sans authentification : un client invité
 * (sans compte) ou quelqu'un bloqué hors de son compte doit pouvoir joindre
 * le support, exactement comme avec l'ancien mailto:.
 */
export async function sendContactMessage(
  _prevState: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!name || name.length < 2) {
    return { error: "Ton nom est trop court." };
  }
  if (!EMAIL_RE.test(email)) {
    return { error: "Adresse email invalide." };
  }
  if (!subject) {
    return { error: "Choisis un sujet." };
  }
  if (!message || message.length < 10) {
    return { error: "Ton message est trop court (10 caractères minimum)." };
  }
  if (message.length > 4000) {
    return { error: "Ton message dépasse 4000 caractères." };
  }

  const result = await sendContactMessageEmail({ name, email, subject, message });

  if (!result.ok) {
    return { error: "Échec de l'envoi. Réessaie dans quelques instants." };
  }

  return { success: true };
}
