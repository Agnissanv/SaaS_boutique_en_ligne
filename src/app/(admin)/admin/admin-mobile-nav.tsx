"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./admin-nav";

/**
 * Menu mobile du back-office admin — ajouté le 21/09/2026, à la demande
 * d'Isaac après le tiroir mobile du dashboard vendeur : "tu n'as pas encore
 * réglé pour le dashboard administrateur... c'est vraiment dégueulasse".
 *
 * Même cause que côté vendeur avant sa refonte, en pire ici : `<AdminNav>`
 * était une barre `flex flex-wrap` contenant logo + 4 liens + bouton de
 * déconnexion sur la même ligne — en dessous d'une certaine largeur, ce
 * bloc entier retombait en plusieurs lignes désordonnées plutôt que de
 * proposer une vraie hiérarchie mobile.
 *
 * Repris quasi à l'identique de `mobile-nav-drawer.tsx` (dashboard vendeur,
 * même jour) plutôt que d'inventer un second cycle de vie de tiroir : même
 * comportement (reste monté pendant l'animation de fermeture, défilement du
 * fond bloqué, fermeture à l'Échap/clic sur le fond/changement de page),
 * mêmes classes d'animation (`drawer-slide-in`, jetons `--duration-sheet`/
 * `--ease-native` déjà définis dans globals.css). Seule différence de fond :
 * le contenu est la liste plate `NAV_ITEMS` (4 liens, pas de sections) au
 * lieu de `<SidebarNav>` — inutile de reproduire des sections pour si peu
 * de liens, mais mêmes classes de lien (icône + libellé, état actif en
 * `bg-white/10`) pour rester cohérent avec le reste de la direction
 * artistique KEVA.
 */
export function AdminMobileNav({ footer }: { footer: React.ReactNode }) {
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
            aria-label="Navigation admin"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-vert-sapin text-ivoire shadow-[8px_0_30px_rgba(4,20,15,0.2)]"
            style={{
              animation: closing ? undefined : "drawer-slide-in var(--duration-sheet) var(--ease-native) both",
              transform: closing ? "translateX(-100%)" : undefined,
              transition: closing ? "transform var(--duration-sheet) var(--ease-native)" : undefined,
            }}
          >
            <div className="flex items-center justify-between px-4 pb-3 pt-[max(14px,env(safe-area-inset-top))]">
              <Link href="/admin" onClick={handleClose} className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- logo statique */}
                <img src="/keva-logo.jpg" alt="KEVA" className="h-7 w-7 rounded object-cover" />
                <span className="font-display text-base font-semibold tracking-tight">KEVA Admin</span>
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

            <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm transition-colors ${
                      active
                        ? "bg-white/10 font-medium text-ivoire"
                        : "text-ivoire/70 hover:bg-white/5 hover:text-ivoire"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

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
