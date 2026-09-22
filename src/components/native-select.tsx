"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/bottom-sheet";

export type NativeSelectOption = { value: string; label: string };

/**
 * Remplace le `<select>` natif — chantier "langage natif", dashboard vendeur
 * (15/09/2026, voir decisions-techniques.md). Généralise le motif déjà posé
 * pour le tri de la marketplace (`sort-select.tsx`, tranche 1) : un bouton
 * qui affiche le choix actuel, ouvre une `BottomSheet` listant les options
 * (coche sur l'option active, fermeture à la sélection).
 *
 * Deux usages rencontrés côté dashboard, couverts par le même composant :
 * - **Champ de formulaire non contrôlé** (catégorie boutique/produit) :
 *   `name` + `defaultValue`, valeur portée par un `<input type="hidden">`
 *   pour rester compatible telle quelle avec les Server Actions existantes
 *   (`FormData.get(name)` ne change pas).
 * - **Valeur contrôlée** (filtres produits, statut de commande) : `value` +
 *   `onChange`, même contrat qu'un `<select>` contrôlé classique — passer
 *   `value` désactive la gestion d'état interne.
 */
export function NativeSelect({
  id,
  name,
  label,
  options,
  value,
  defaultValue,
  onChange,
  placeholder = "Choisir...",
  disabled,
  className,
}: {
  id?: string;
  name?: string;
  label: string;
  options: NativeSelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const current = isControlled ? value : internalValue;
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === current);

  function handleSelect(next: string) {
    if (!isControlled) setInternalValue(next);
    onChange?.(next);
    setOpen(false);
  }

  return (
    <>
      {name && <input type="hidden" name={name} value={current} />}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={`flex items-center justify-between gap-2 rounded-md border border-ligne bg-white px-3 py-2 text-left text-sm text-encre disabled:opacity-50 ${className ?? ""}`}
      >
        <span className={selected ? "" : "text-encre/50"}>
          {selected ? selected.label : placeholder}
        </span>
        <span aria-hidden="true" className="shrink-0 text-encre/40">
          ▾
        </span>
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={label}>
        <ul className="flex flex-col">
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                onClick={() => handleSelect(o.value)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm ${
                  o.value === current ? "font-medium text-vert-actif" : "text-encre"
                }`}
              >
                {o.label}
                {o.value === current && <span aria-hidden="true">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </>
  );
}
