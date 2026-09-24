/**
 * "+225 07 00 00 00 00" -> "22507000000" (format attendu par wa.me).
 *
 * Extrait le 15/09/2026 en ajoutant le contact WhatsApp boutique
 * (src/components/whatsapp-contact-button.tsx) : la même fonction était
 * déjà dupliquée dans status-form.tsx et commandes/[orderId]/page.tsx —
 * même logique que l'extraction de CATEGORIES (src/lib/categories.ts).
 *
 * **Bug corrigé le 24/09/2026** — signalé par Isaac : WhatsApp refusait
 * d'ouvrir la discussion ("il manque l'indicatif pays") pour un numéro
 * client/boutique saisi au format local ivoirien sans indicatif (ex:
 * "0769398708"), alors que rien dans l'app n'oblige à saisir le numéro avec
 * le +225 (placeholder du champ boutique à part, jamais vérifié — et le
 * champ téléphone du checkout client n'a aucune indication du tout). Avant
 * ce correctif, la fonction se contentait de retirer les caractères non
 * numériques, sans jamais ajouter l'indicatif manquant.
 *
 * Un numéro ivoirien local fait 10 chiffres depuis le plan de numérotation
 * 2021 (ex: 07/05/01/21/25/27 + 8 chiffres) et se compose depuis
 * l'étranger en gardant tous ces 10 chiffres tels quels après le 225 — le
 * chiffre de tête n'est PAS un préfixe de tri à retirer comme dans
 * certains pays, contrairement à une intuition répandue (vérifié auprès
 * d'Orange CI, source officielle du plan de numérotation : "il faudra
 * composer... le nouveau numéro du correspondant après le 225" ; confirmé
 * par le format du numéro de contact d'ARTCI elle-même, +225 27 20 34 43 73
 * — 10 chiffres conservés). D'où le simple ajout du préfixe "225" devant un
 * numéro à 10 chiffres, sans retirer le premier.
 *
 * Un numéro déjà saisi avec l'indicatif (+225, 00225, ou 225 tout court) est
 * laissé tel quel après nettoyage. Un numéro d'une autre longueur (numéro
 * étranger, saisie incomplète...) n'est pas modifié non plus : mieux vaut un
 * lien wa.me qui échoue clairement que d'ajouter un 225 à tort sur un
 * numéro qui n'en a pas besoin.
 */
export function toWhatsappNumber(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");

  if (digits.startsWith("00225")) {
    return digits.slice(2);
  }
  if (digits.startsWith("225") && digits.length >= 12) {
    return digits;
  }
  if (digits.length === 10) {
    return `225${digits}`;
  }

  return digits;
}
