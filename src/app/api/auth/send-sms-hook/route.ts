import { Webhook } from "standardwebhooks";
import { sendSmsViaOrange } from "@/lib/sms/orange";

/**
 * Send SMS Hook Supabase Auth — appelé par Supabase à chaque envoi d'OTP
 * téléphone, à la place d'un fournisseur intégré (Twilio, Vonage...).
 * Permet de brancher l'API Orange SMS CI (~7 FCFA/SMS) au lieu de Twilio
 * (~290 FCFA/SMS vers la CI). Voir decisions-techniques.md.
 *
 * À configurer dans Supabase : Authentication > Hooks > Send SMS Hook,
 * type "HTTPS", URL = https://<ton-domaine>/api/auth/send-sms-hook
 *
 * Doc Supabase : https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook
 */
export async function POST(request: Request) {
  const secret = process.env.SEND_SMS_HOOK_SECRET; // format "v1,whsec_xxxxx"
  if (!secret) {
    return Response.json({ error: "SEND_SMS_HOOK_SECRET manquant" }, { status: 500 });
  }

  const payload = await request.text();
  const headers = Object.fromEntries(request.headers);

  let user: { phone?: string };
  let sms: { otp?: string };

  try {
    const wh = new Webhook(secret.replace("v1,whsec_", ""));
    const verified = wh.verify(payload, headers) as {
      user: { phone?: string };
      sms: { otp?: string };
    };
    user = verified.user;
    sms = verified.sms;
  } catch {
    // Signature invalide : requête non authentifiée par Supabase, on rejette.
    return Response.json({ error: "Signature invalide" }, { status: 401 });
  }

  if (!user.phone || !sms.otp) {
    return Response.json({ error: "Payload incomplet" }, { status: 400 });
  }

  try {
    await sendSmsViaOrange(
      user.phone,
      `Votre code de vérification est ${sms.otp}. Il expire dans quelques minutes.`
    );
  } catch (error) {
    console.error("Échec envoi SMS OTP :", error);
    return Response.json({ error: "Échec de l'envoi du SMS" }, { status: 500 });
  }

  // Supabase attend un corps vide (200) en cas de succès — un JSON peut être
  // interprété comme une erreur même si le SMS est parti.
  return new Response(null, { status: 200 });
}
