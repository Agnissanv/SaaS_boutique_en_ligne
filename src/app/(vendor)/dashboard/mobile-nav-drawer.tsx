"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarNav } from "./sidebar-nav";

/**
 * Menu mobile du dashboard vendeur — remplace, le 21/09/2026, l'ancienne
 * barre horizontale défilante (`MOBILE_NAV_LINKS` dans layout.tsx) à la
 * demande d'Isaac après avoir vu la version mobile en vrai : les onze
 * liens débordaient du cadre et le texte était tronqué ("la nav n'est pas
 * jolie à voir"). Isaac demandait un déclencheur "trois points" — au sens
 * "bouton qui ouvre un menu", pas au sens du menu kebab (•••, réservé aux
 * actions secondaires en UX). On garde donc l'icône hamburger (☰), le
 * symbole universellement reconnu pour "ouvrir la navigation", pour que le
 * geste reste intuitif pour les vendeurs.
 *
 * Contenu du tiroir : le même `<SidebarNav>` que la sidebar desktop (mêmes
 * icônes, mêmes sections, même filtrage `isOwner` pour un collaborateur —
 * voir src/lib/shop-access.ts) plutôt qu'une liste dupliquée à maintenir en
 * double. Le pied de tiroir (boutique en ligne / espace client /
 * déconnexion) est passé en `footer` par layout.tsx : ce sont des liens et
 * un `<form action={signOut}>` (Server Action) déjà résolus côté serveur,
 * pas de raison de les reconstruire ici.
 *
 * Ouvre depuis la gauche, même bord que la sidebar desktop, dans la
 * continuité visuelle plutôt qu'un sens différent selon la largeur d'écran.
 *
 * Cycle de vie et gestes calqués sur `<BottomSheet>` (composant existant,
 * chantier "langage natif" du 15/09/2026) : reste monté pendant l'animation
 * de fermeture, fond bloqué (`overflow: hidden`) tant que le tiroir est
 * ouvert, fermeture à l'Échap. Fermeture automatique au changement de page
 * (clic sur un lien du menu) ajoutée ici : on compare le pathname au
 * pathname précédent *pendant le rendu* (motif React officiel pour "ajuster
 * un état quand une valeur surveillée change", déjà utilisé pour
 * `ReviewReplyForm` — évite un `useEffect` + `setState`, interdit par notre
 * règle ESLint `react-hooks/set-state-in-effect`).
 */
export function MobileNavDrawer({
  isOwner,
  footer,
}: {
  isOwner: boolean;
  footer: React.ReactNode;
}) {
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);

  const handleClose = useCallback(() => {
    setOpen(false);
    setClosing(true);
  }, []);

  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    if (mounted && !closing) {
      setOpen(false);
      setClosing(true);
    }
  }

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => setMounted(false), 320);
    return () => clearTimeout(timer);
  }, [closing]);

  useEffect(() => {
    if (!mounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [mounted, handleClose]);

  function handleOpen() {
    setMounted(true);
    setClosing(false);
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Ouvrir le menu"
        aria-expanded={open}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ivoire hover:bg-white/10"
      >
        <IconMenu className="h-5 w-5" />
      </button>

      {mounted && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={handleClose}
            className="absolute inset-0 bg-vert-profond/50"
            style={{
              animation: `sheet-backdrop-in var(--duration-sheet) ease ${closing ? "reverse" : "normal"} both`,
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation du dashboard"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-vert-sapin text-ivoire shadow-[8px_0_30px_rgba(4,20,15,0.2)]"
            style={{
              animation: closing ? undefined : "drawer-slide-in var(--duration-sheet) var(--ease-native) both",
              transform: closing ? "translateX(-100%)" : undefined,
              transition: closing ? "transform var(--duration-sheet) var(--ease-native)" : undefined,
            }}
          >
            <div className="flex items-center justify-between px-4 pb-3 pt-[max(14px,env(safe-area-inset-top))]">
              <Link href="/dashboard" onClick={handleClose} className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- logo statique */}
                <img src="/keva-logo.jpg" alt="KEVA" className="h-7 w-7 rounded object-cover" />
                <span className="font-display text-base font-bold tracking-wide">KEVA</span>
              </Link>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Fermer le menu"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ivoire/70 hover:bg-white/10 hover:text-ivoire"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            <SidebarNav isOwner={isOwner} />

            <div className="border-t border-white/10 px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))] text-sm">
              {footer}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function IconMenu(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

function IconClose(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
