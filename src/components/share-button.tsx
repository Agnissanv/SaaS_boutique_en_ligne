"use client";

/**
 * Bouton « Partager » (13/10/2026) : ouvre la feuille de partage du téléphone
 * (WhatsApp, Facebook, SMS...) quand elle existe, sinon un partage WhatsApp —
 * le canal principal des vendeuses KEVA pour faire connaître leur boutique.
 */
export function ShareButton({
  title,
  text,
  label = "Partager",
  className,
}: {
  title: string;
  text: string;
  label?: string;
  className?: string;
}) {
  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch {
        // Partage annulé : rien à faire.
      }
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank", "noopener");
  }

  return (
    <button
      type="button"
      onClick={share}
      className={
        className ??
        "inline-flex items-center justify-center gap-1.5 rounded-md border border-ligne bg-white px-4 py-2.5 text-sm font-semibold text-encre transition hover:border-vert-actif hover:text-vert-actif"
      }
    >
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
        <path d="M10 13V3" />
        <path d="m6.5 6.5 3.5-3.5 3.5 3.5" />
        <path d="M5 10H4.5A1.5 1.5 0 0 0 3 11.5v4A1.5 1.5 0 0 0 4.5 17h11a1.5 1.5 0 0 0 1.5-1.5v-4a1.5 1.5 0 0 0-1.5-1.5H15" />
      </svg>
      {label}
    </button>
  );
}
