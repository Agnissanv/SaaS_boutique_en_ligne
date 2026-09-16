"use client";

import { useTransition } from "react";
import { removeCollaborator } from "./actions";
import type { Collaborator } from "./page";

/**
 * `canManage` : `false` si le vendeur a downgradé depuis Pro — la liste
 * reste visible (traçabilité de qui avait accès) mais plus retirable depuis
 * ici tant qu'il n'est pas remonté de plan, même principe que les codes
 * promo/variantes gelés ailleurs. L'accès effectif d'un collaborateur actif
 * est de toute façon déjà coupé côté base (`is_shop_collaborator` revérifie
 * le plan courant), pas seulement caché ici.
 */
export function CollaboratorList({
  collaborators,
  canManage,
}: {
  collaborators: Collaborator[];
  canManage: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  if (collaborators.length === 0) {
    return (
      <p className="mt-6 text-sm text-encre/60">
        Aucun collaborateur pour l&apos;instant.
      </p>
    );
  }

  return (
    <div className="mt-6 overflow-x-auto rounded-md border border-ligne bg-white">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead>
          <tr className="border-b border-ligne text-xs uppercase tracking-wide text-encre/50">
            <th className="px-3 py-2 font-medium">Email</th>
            <th className="px-3 py-2 font-medium">Statut</th>
            <th className="px-3 py-2 font-medium">Invité le</th>
            <th className="px-3 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ligne">
          {collaborators.map((collab) => (
            <tr key={collab.id}>
              <td className="px-3 py-2.5 text-encre">{collab.invited_email}</td>
              <td className="px-3 py-2.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    collab.status === "active"
                      ? "bg-succes/15 text-succes"
                      : "bg-attention/15 text-attention"
                  }`}
                >
                  {collab.status === "active" ? "Actif" : "En attente"}
                </span>
              </td>
              <td className="px-3 py-2.5 text-encre/70">
                {new Date(collab.invited_at).toLocaleDateString("fr-FR")}
              </td>
              <td className="px-3 py-2.5">
                {canManage ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => startTransition(() => removeCollaborator(collab.id))}
                    className="text-erreur underline disabled:opacity-50"
                  >
                    Retirer
                  </button>
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
