"use client";

import { useEffect, useState } from "react";

export type PartnerCodeStatus =
  | { state: "empty" }
  | { state: "checking" }
  | { state: "valid"; code: string; name: string | null }
  | { state: "invalid" };

/**
 * Champ « Code partenaire (facultatif) » (13/10/2026, programme partenaire).
 *
 * Replié par défaut derrière un simple lien (« J'ai un code partenaire ») pour
 * ne pas alourdir l'inscription de tout le monde ; déjà ouvert et rempli quand
 * le visiteur est arrivé par le lien d'une partenaire. Le code est vérifié
 * pendant la frappe (« Code de Djandjou ✓ ») via /api/partenaires/code.
 */
export function PartnerCodeField({
  value,
  onChange,
  onStatusChange,
  initiallyOpen,
}: {
  value: string;
  onChange: (value: string) => void;
  onStatusChange: (status: PartnerCodeStatus) => void;
  initiallyOpen: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [status, setStatus] = useState<PartnerCodeStatus>({ state: "empty" });

  useEffect(() => {
    const code = value.trim();
    if (!code) {
      // Pas de setState synchrone dans l'effet (règle react-hooks) : remis à
      // « vide » dans le gestionnaire de saisie plus bas.
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      fetch(`/api/partenaires/code?c=${encodeURIComponent(code)}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : { valid: false }))
        .then((data: { valid: boolean; code?: string; name?: string | null }) => {
          const next: PartnerCodeStatus =
            data.valid && data.code
              ? { state: "valid", code: data.code, name: data.name ?? null }
              : { state: "invalid" };
          setStatus(next);
          onStatusChange(next);
        })
        .catch(() => {});
    }, 350);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [value, onStatusChange]);

  function handleChange(next: string) {
    const cleaned = next.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
    onChange(cleaned);
    const nextStatus: PartnerCodeStatus = cleaned ? { state: "checking" } : { state: "empty" };
    setStatus(nextStatus);
    onStatusChange(nextStatus);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-sm text-vert-actif hover:text-vert-sapin font-medium transition-colors"
      >
        J&apos;ai un code partenaire
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-encre" htmlFor="partnerCode">
        Code partenaire <span className="font-normal text-encre/50">(facultatif)</span>
      </label>
      <input
        id="partnerCode"
        name="partner-code"
        type="text"
        autoComplete="off"
        autoCapitalize="characters"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Ex : AWA225"
        className="rounded-md border border-ligne px-3 py-2 font-mono text-sm uppercase placeholder:normal-case placeholder:font-sans placeholder:tracking-normal tracking-wide focus:border-vert-actif focus:outline-none"
      />
      {status.state === "valid" ? (
        <p className="text-xs text-succes">
          Code de {status.name ?? status.code} ✓
        </p>
      ) : status.state === "invalid" ? (
        <p className="text-xs text-erreur">Ce code n&apos;existe pas. Vérifie-le ou laisse le champ vide.</p>
      ) : null}
    </div>
  );
}
