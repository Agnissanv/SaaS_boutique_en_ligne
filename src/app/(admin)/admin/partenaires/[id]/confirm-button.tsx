"use client";

/**
 * Bouton d'envoi qui demande confirmation avant une action lourde (fin de
 * partenariat, annulation d'acceptation, retrait d'une boutique).
 */
export function ConfirmButton({
  message,
  className,
  children,
}: {
  message: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
      className={className}
    >
      {children}
    </button>
  );
}
