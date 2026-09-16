"use client";

import { useTransition } from "react";
import { togglePromoCodeActive, deletePromoCode } from "./actions";
import type { PromoCode } from "./page";

function discountLabel(code: PromoCode): string {
  return code.discount_type === "percentage"
    ? `-${code.discount_value}%`
    : `-${code.discount_value} FCFA`;
}

/**
 * Liste des codes — pas de modification une fois créé (voir
 * promo-code-form.tsx), juste activer/désactiver et supprimer, même geste
 * que `toggleProductActive`/`deleteProduct` ailleurs dans le dashboard.
 *
 * `canManage` : `false` si le vendeur a downgradé depuis Pro — ses codes
 * existants restent visibles (traçabilité, un client a peut-être encore un
 * code en main) mais gelés, ni activables ni supprimables tant qu'il n'est
 * pas remonté, même principe que les variantes produit gelées ailleurs.
 */
export function PromoCodeList({
  promoCodes,
  canManage,
}: {
  promoCodes: PromoCode[];
  canManage: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  if (promoCodes.length === 0) {
    return (
      <p className="mt-6 text-sm text-encre/60">
        Aucun code promo pour l&apos;instant.
      </p>
    );
  }

  return (
    <div className="mt-6 overflow-x-auto rounded-md border border-ligne bg-white">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-ligne text-xs uppercase tracking-wide text-encre/50">
            <th className="px-3 py-2 font-medium">Code</th>
            <th className="px-3 py-2 font-medium">Réduction</th>
            <th className="px-3 py-2 font-medium">Utilisations</th>
            <th className="px-3 py-2 font-medium">Expire le</th>
            <th className="px-3 py-2 font-medium">Statut</th>
            <th className="px-3 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ligne">
          {promoCodes.map((code) => (
            <tr key={code.id}>
              <td className="px-3 py-2.5 font-mono font-medium text-encre">{code.code}</td>
              <td className="px-3 py-2.5 text-encre/70">{discountLabel(code)}</td>
              <td className="px-3 py-2.5 text-encre/70">
                {code.used_count}
                {code.max_uses !== null ? ` / ${code.max_uses}` : ""}
              </td>
              <td className="px-3 py-2.5 text-encre/70">
                {code.expires_at
                  ? new Date(code.expires_at).toLocaleDateString("fr-FR")
                  : "—"}
              </td>
              <td className="px-3 py-2.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    code.is_active
                      ? "bg-succes/15 text-succes"
                      : "bg-encre/10 text-encre/60"
                  }`}
                >
                  {code.is_active ? "Actif" : "Désactivé"}
                </span>
              </td>
              <td className="px-3 py-2.5">
                {canManage ? (
                  <div className="flex items-center gap-2.5 whitespace-nowrap text-encre/70">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(() => togglePromoCodeActive(code.id, !code.is_active))
                      }
                      className="underline hover:text-cuivre-profond disabled:opacity-50"
                    >
                      {code.is_active ? "Désactiver" : "Activer"}
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => startTransition(() => deletePromoCode(code.id))}
                      className="text-erreur underline disabled:opacity-50"
                    >
                      Supprimer
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-encre/40">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
