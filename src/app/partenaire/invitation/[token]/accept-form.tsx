"use client";

import { useActionState, useEffect, useState } from "react";
import { acceptPartnerInvitation, type AcceptInvitationState } from "./actions";
import { PAYOUT_METHOD_LABELS } from "@/lib/partners";

type CodeAvailability = "idle" | "checking" | "free" | "taken";

/**
 * Formulaire d'acceptation : nom affiché, code, moyen et numéro de paiement,
 * confirmation du contrat signé. Le code est vérifié pendant la frappe
 * (« déjà pris ») ; la vérification finale reste celle de la base.
 */
export function AcceptInvitationForm({ token, defaultName }: { token: string; defaultName: string }) {
  const initialState: AcceptInvitationState = {};
  const [state, formAction, pending] = useActionState(
    acceptPartnerInvitation.bind(null, token),
    initialState
  );
  const [code, setCode] = useState("");
  const [availability, setAvailability] = useState<CodeAvailability>("idle");

  useEffect(() => {
    if (code.length < 3) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      fetch(`/api/partenaires/code?c=${encodeURIComponent(code)}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : { valid: false }))
        .then((data: { valid: boolean }) => setAvailability(data.valid ? "taken" : "free"))
        .catch(() => {});
    }, 350);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [code]);

  function handleCodeChange(raw: string) {
    const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
    setCode(cleaned);
    setAvailability(cleaned.length >= 3 ? "checking" : "idle");
  }

  const inputClass =
    "rounded-md border border-ligne px-3 py-2 text-sm focus:border-vert-actif focus:outline-none";

  return (
    <form action={formAction} className="mt-5 flex flex-col gap-3">
      <label className="text-sm font-medium text-encre" htmlFor="display_name">
        Ton nom affiché
      </label>
      <input
        id="display_name"
        name="display_name"
        required
        maxLength={60}
        defaultValue={defaultName}
        placeholder="Ex : Awa Koné"
        className={inputClass}
      />

      <label className="text-sm font-medium text-encre" htmlFor="code">
        Ton code partenaire
      </label>
      <input
        id="code"
        name="code"
        required
        autoComplete="off"
        autoCapitalize="characters"
        value={code}
        onChange={(e) => handleCodeChange(e.target.value)}
        placeholder="Ex : AWA225"
        className={`${inputClass} font-mono uppercase placeholder:normal-case placeholder:font-sans placeholder:tracking-normal tracking-wide`}
      />
      <p className="-mt-1 text-xs text-encre/60">
        {availability === "taken" ? (
          <span className="text-erreur">Ce code est déjà pris. Choisis-en un autre.</span>
        ) : availability === "free" ? (
          <span className="text-succes">Code disponible ✓</span>
        ) : (
          "3 à 20 lettres ou chiffres, facile à dire dans une vidéo. Ton lien sera shopkeva.com/p/TONCODE."
        )}
      </p>

      <label className="text-sm font-medium text-encre" htmlFor="payout_method">
        Où recevoir tes commissions
      </label>
      <div className="flex gap-2">
        <select
          id="payout_method"
          name="payout_method"
          required
          defaultValue="wave"
          className={`${inputClass} shrink-0 bg-white`}
        >
          {Object.entries(PAYOUT_METHOD_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          name="payout_phone"
          type="tel"
          required
          inputMode="tel"
          autoComplete="tel"
          placeholder="07 00 00 00 00"
          aria-label="Numéro de paiement"
          className={`${inputClass} min-w-0 flex-1`}
        />
      </div>

      <label className="mt-1 flex items-start gap-2 text-sm text-encre/80">
        <input type="checkbox" name="contrat" required className="mt-1" />
        <span>J&apos;ai signé le contrat de partenariat KEVA et j&apos;en accepte les conditions.</span>
      </label>

      {state.error ? <p className="text-sm text-erreur">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending || availability === "taken"}
        className="mt-2 rounded-md bg-vert-actif px-4 py-2.5 text-sm font-medium text-ivoire hover:bg-vert-sapin disabled:opacity-50"
      >
        {pending ? "Activation..." : "Activer mon espace partenaire"}
      </button>
    </form>
  );
}
