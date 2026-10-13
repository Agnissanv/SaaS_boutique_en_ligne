import Link from "next/link";

/**
 * État vide soigné, partagé par les pages publiques (paniers, favoris...) —
 * 13/10/2026 : ces pages n'affichaient qu'une ligne de texte et un lien.
 */
export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action: { href: string; label: string };
}) {
  return (
    <div className="mt-6 flex flex-col items-center rounded-2xl border border-ligne bg-white px-6 py-10 text-center">
      <span
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-brume text-vert-actif [&>svg]:h-7 [&>svg]:w-7"
      >
        {icon}
      </span>
      <p className="mt-4 font-display text-base font-semibold text-encre">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-encre/70">{text}</p>
      <Link
        href={action.href}
        className="mt-5 rounded-full bg-vert-actif px-5 py-2.5 text-sm font-semibold text-ivoire transition hover:bg-vert-sapin"
      >
        {action.label}
      </Link>
    </div>
  );
}

export function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 7h12l-1.2 11.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8L6 7Z" />
      <path d="M9 7V6a3 3 0 0 1 6 0v1" />
    </svg>
  );
}

export function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
    </svg>
  );
}
