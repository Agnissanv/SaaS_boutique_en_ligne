"use client";

import { useEffect, useRef, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";

/**
 * Formulaire de recherche SANS rechargement de page (09/10/2026, demande
 * d'Isaac : « la page entière ne doit pas s'actualiser, seulement la partie
 * où s'affichent les produits »).
 *
 * Reste un vrai `<form method="GET">` (sans JavaScript, la recherche marche
 * comme avant), mais à l'envoi on navigue côté client : en-tête, hero et
 * carrousel restent en place, seule la grille de résultats change. Pendant
 * le chargement, `data-search-pending` est posé sur <html> (la grille est
 * atténuée, voir globals.css) et `data-pending` sur le formulaire (bouton en
 * attente) ; une fois les résultats arrivés, on fait défiler jusqu'à eux.
 */
export function InstantSearchForm({
  action,
  scrollTargetId,
  onSubmitted,
  className,
  children,
}: {
  action: string;
  /** id de la zone de résultats vers laquelle défiler après la recherche. */
  scrollTargetId?: string;
  onSubmitted?: () => void;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const scrollAfterNavigation = useRef(false);

  useEffect(() => {
    if (!isPending) return;
    const root = document.documentElement;
    root.setAttribute("data-search-pending", "");
    return () => root.removeAttribute("data-search-pending");
  }, [isPending]);

  useEffect(() => {
    if (isPending || !scrollAfterNavigation.current) return;
    scrollAfterNavigation.current = false;
    if (!scrollTargetId) return;
    const target = document.getElementById(scrollTargetId);
    // Seulement si les résultats ne sont pas déjà en haut de l'écran.
    if (target && Math.abs(target.getBoundingClientRect().top) > 120) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [isPending, scrollTargetId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    for (const [name, value] of new FormData(event.currentTarget)) {
      if (typeof value === "string" && value.trim()) params.append(name, value.trim());
    }
    const query = params.toString();
    onSubmitted?.();
    scrollAfterNavigation.current = true;
    startTransition(() => {
      router.push(query ? `${action}?${query}` : action, { scroll: false });
    });
  }

  return (
    <form
      method="GET"
      action={action}
      role="search"
      onSubmit={handleSubmit}
      data-pending={isPending ? "" : undefined}
      aria-busy={isPending}
      className={className}
    >
      {children}
    </form>
  );
}
