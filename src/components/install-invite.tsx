"use client";

import { useEffect, useState } from "react";
import {
  canShowInvite,
  getVisitCount,
  markInviteShown,
  neverInvite,
  snoozeInvite,
  startInstall,
} from "@/lib/pwa-install";

type InviteContext = "order" | "returning" | "vendor" | "partner";

const COPY: Record<InviteContext, { title: string; text: string }> = {
  order: {
    title: "Retrouve ta commande en un appui",
    text: "Installe KEVA sur ton écran d'accueil pour suivre ta commande et retrouver tes boutiques.",
  },
  returning: {
    title: "Tu reviens souvent ? Installe KEVA",
    text: "Ouvre la marketplace en un appui depuis ton écran d'accueil, comme une vraie appli.",
  },
  vendor: {
    title: "Ta boutique dans ta poche",
    text: "Installe KEVA pour gérer tes commandes en un appui et recevoir les alertes de nouvelles commandes.",
  },
  partner: {
    title: "Tes résultats en un appui",
    text: "Installe KEVA pour ouvrir ton espace partenaire directement depuis ton écran d'accueil.",
  },
};

/** Visites minimum avant d'inviter un visiteur « qui revient » (jamais à la 1re). */
const RETURNING_MIN_VISITS = 3;

/**
 * Invitation à installer KEVA, posée aux moments où ça vaut le coup
 * (13/10/2026, demande d'Isaac : « à des moments stratégiques [...] pas trop
 * encombrant, mais que l'utilisateur sache qu'il a la possibilité ») :
 * - client : juste après une commande confirmée, ou à sa 3e visite
 *   (accueil, vitrine d'une boutique) — jamais pendant l'achat ;
 * - vendeur : accueil du tableau de bord ;
 * - partenaire : accueil de l'espace partenaire.
 *
 * Petite carte en bas d'écran, au-dessus de la barre de navigation, qui
 * apparaît quelques secondes après l'arrivée. Règles de fréquence dans
 * `pwa-install.ts` : une par visite, « Plus tard » = 14 jours de silence,
 * « Ne plus me le proposer » = jamais (le bouton « Installer l'appli » du
 * pied de page, du compte et des menus reste là).
 */
export function InstallInvite({ context, delayMs = 2500 }: { context: InviteContext; delayMs?: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!canShowInvite()) return;
      if (context === "returning" && getVisitCount() < RETURNING_MIN_VISITS) return;
      markInviteShown();
      setVisible(true);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [context, delayMs]);

  if (!visible) return null;

  const copy = COPY[context];
  const reason = context === "returning" ? "returning" : context;

  return (
    <div
      role="region"
      aria-label="Installer l'appli KEVA"
      className="kv-toast-in fixed inset-x-3 z-40 rounded-2xl border border-ligne bg-white p-4 shadow-[0_12px_32px_rgba(4,20,15,0.18)] transition-[bottom] duration-300 bottom-[calc(var(--bottom-nav-offset,0px)+max(12px,env(safe-area-inset-bottom,0px)))] sm:left-auto sm:right-6 sm:w-[360px]"
    >
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- icône statique de l'appli */}
        <img src="/icons/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-encre">{copy.title}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-encre/70">{copy.text}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => {
            // Le guide a été vu : pas de nouvelle invitation avant 14 jours
            // s'il ne va pas jusqu'au bout (le bouton du pied de page reste).
            snoozeInvite();
            setVisible(false);
            void startInstall(reason);
          }}
          className="flex h-10 flex-1 items-center justify-center rounded-xl bg-vert-actif text-sm font-semibold text-ivoire transition hover:bg-vert-sapin"
        >
          Installer
        </button>
        <button
          type="button"
          onClick={() => {
            snoozeInvite();
            setVisible(false);
          }}
          className="flex h-10 flex-1 items-center justify-center rounded-xl border border-ligne text-sm font-semibold text-encre transition hover:bg-brume"
        >
          Plus tard
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          neverInvite();
          setVisible(false);
        }}
        className="mx-auto mt-2 block text-xs text-encre/60 transition hover:text-encre"
      >
        Ne plus me le proposer
      </button>
    </div>
  );
}
