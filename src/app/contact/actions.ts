"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";
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

  // Écrit en base AVANT l'envoi de l'email — corrigé le 22/09/2026 (audit
  // back-office) : jusqu'ici ce message n'existait NULLE PART ailleurs que
  // dans l'email envoyé via Brevo. Si cet email se perdait, le message du
  // client disparaissait sans qu'Isaac le sache. Cette table est la copie de
  // référence, consultable dans /admin/messages même si l'email échoue —
  // voir 0038_contact_messages.sql pour le détail du raisonnement.
  const serviceRole = createServiceRoleClient();
  const { error: insertError } = await serviceRole.from("contact_messages").insert({
    name,
    email,
    subject,
    message,
  });

  if (insertError) {
    console.error("sendContactMessage — échec insertion contact_messages:", insertError);
    return { error: "Échec de l'envoi. Réessaie dans quelques instants." };
  }

  // Best-effort : l'email est une notification de confort pour réagir vite,
  // pas la source de vérité (elle, c'est la ligne ci-dessus). Un échec ici ne
  // fait plus perdre le message — Isaac le retrouve dans /admin/messages
  // même si Brevo est en panne ou si l'email atterrit en spam.
  const result = await sendContactMessageEmail({ name, email, subject, message });
  if (!result.ok) {
    console.error("sendContactMessage — échec envoi email (message conservé en base):", result.error);
  }

  return { success: true };
}
