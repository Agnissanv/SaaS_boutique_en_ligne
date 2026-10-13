/**
 * Étapes de la commande (13/10/2026, lot 2 UX) : Panier › Coordonnées ›
 * Confirmation, pour que le client sache où il en est et ce qui reste à faire.
 * Trois colonnes (pastille au-dessus, libellé en dessous) reliées par une
 * ligne : les libellés tiennent en entier même sur un petit téléphone.
 */
const STEPS = ["Panier", "Coordonnées", "Confirmation"] as const;

export function CheckoutSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol aria-label="Étapes de la commande" className="relative grid grid-cols-3 text-center text-xs font-medium">
      <span aria-hidden="true" className="absolute left-[16.67%] right-[16.67%] top-3 h-px bg-ligne" />
      <span
        aria-hidden="true"
        className="absolute left-[16.67%] top-3 h-px bg-vert-actif transition-all"
        style={{ width: `${((current - 1) / (STEPS.length - 1)) * 66.66}%` }}
      />
      {STEPS.map((label, index) => {
        const step = index + 1;
        const done = step < current;
        const active = step === current;
        return (
          <li key={label} className="relative flex flex-col items-center gap-1.5" aria-current={active ? "step" : undefined}>
            <span
              className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ring-4 ring-white ${
                done || active ? "bg-vert-actif text-ivoire" : "bg-brume text-encre/70"
              }`}
            >
              {done ? (
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
                  <path d="m5 10.5 3.2 3.2L15 7" />
                </svg>
              ) : (
                step
              )}
            </span>
            <span className={active ? "text-encre" : "text-encre/70"}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
