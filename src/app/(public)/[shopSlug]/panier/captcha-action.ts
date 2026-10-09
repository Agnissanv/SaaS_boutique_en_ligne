"use server";

import { headers } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export type CheckoutCaptchaResult = { passId: string } | { error: string };

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Vérifie le jeton Cloudflare Turnstile du tunnel de commande et délivre un
 * « laissez-passer » à usage unique (09/10/2026, voir migration 0059).
 *
 * Pourquoi un laissez-passer plutôt que de créer la commande ici : la commande
 * reste créée par l'appel `create_order` du navigateur, qui garde ainsi la
 * session du client (`auth.uid()` -> `orders.customer_id`) sans rien changer
 * au reste du tunnel. Le captcha ne peut pas être contourné en appelant
 * `create_order` directement : une fois la migration 0060 appliquée, la
 * fonction refuse toute commande sans laissez-passer valide, et seul ce
 * serveur (clé secrète Turnstile + client service role) peut en créer.
 *
 * Limite de débit par IP en plus (30 vérifications / 10 min) : chaque appel
 * interroge Cloudflare, inutile de laisser un script le marteler.
 */
export async function verifyCheckoutCaptcha(token: string): Promise<CheckoutCaptchaResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("verifyCheckoutCaptcha — TURNSTILE_SECRET_KEY manquante.");
    return { error: "La vérification anti-robot est momentanément indisponible. Réessaie plus tard." };
  }

  if (typeof token !== "string" || token.length === 0 || token.length > 2048) {
    return { error: "Vérification anti-robot invalide. Réessaie." };
  }

  const ip = getClientIp(await headers());
  const allowed = await checkRateLimit("checkout_captcha", ip, { maxAttempts: 30, windowMinutes: 10 });
  if (!allowed) {
    return { error: "Trop de tentatives. Réessaie dans quelques minutes." };
  }

  const body = new URLSearchParams({ secret, response: token });
  if (ip !== "unknown") body.set("remoteip", ip);

  try {
    const response = await fetch(SITEVERIFY_URL, { method: "POST", body, cache: "no-store" });
    const result = (await response.json()) as { success?: boolean; "error-codes"?: string[] };
    if (result.success !== true) {
      console.error("verifyCheckoutCaptcha — jeton refusé par Cloudflare:", result["error-codes"]);
      return { error: "Vérification anti-robot échouée. Réessaie." };
    }
  } catch (error) {
    console.error("verifyCheckoutCaptcha — Cloudflare injoignable:", error);
    return { error: "La vérification anti-robot n'a pas pu aboutir. Réessaie." };
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("checkout_captcha_passes").insert({}).select("id").single();
  if (error || !data) {
    console.error("verifyCheckoutCaptcha — création du laissez-passer impossible:", error);
    return { error: "Impossible de finaliser la vérification. Réessaie." };
  }

  return { passId: data.id };
}
