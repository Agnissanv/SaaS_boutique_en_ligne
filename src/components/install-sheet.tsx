"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import {
  INSTALL_QUERY_PARAM,
  chromeIntentUrl,
  closeInstallSheet,
  getInstallPlatform,
  installPageUrl,
  openInstallSheet,
  promptInstall,
  registerVisit,
  type InstallPlatform,
  type InstallReason,
} from "@/lib/pwa-install";
import { useInstallPlatform, useInstallSheet } from "@/lib/use-install";

/**
 * Feuille « Installer KEVA » (13/10/2026) — un seul exemplaire, monté dans
 * `layout.tsx`, ouvert par `openInstallSheet()` / `startInstall()` depuis
 * n'importe quel bouton du site. Explique la méthode propre au téléphone :
 * fenêtre officielle en un appui (Chrome, Edge, Samsung Internet), guide
 * illustré sur iPhone, ouverture dans le vrai navigateur depuis TikTok /
 * Instagram / Facebook. Voir `src/lib/pwa-install.ts`.
 *
 * Gère aussi `?installer=1` : le lien « Ouvrir dans Chrome » d'un navigateur
 * intégré y mène, la feuille s'ouvre donc toute seule à l'arrivée.
 */
export function InstallSheetHost() {
  const { open, reason } = useInstallSheet();
  const platform = useInstallPlatform();

  useEffect(() => {
    registerVisit();
    const url = new URL(window.location.href);
    if (url.searchParams.get(INSTALL_QUERY_PARAM) !== "1") return;
    url.searchParams.delete(INSTALL_QUERY_PARAM);
    window.history.replaceState(window.history.state, "", url.toString());
    if (getInstallPlatform() !== "installed") openInstallSheet("general");
  }, []);

  return (
    // Au-dessus du tiroir de navigation du tableau de bord (z-50), d'où le
    // bouton « Installer l'appli » peut aussi ouvrir cette feuille.
    <div className="relative z-[60]">
      <BottomSheet open={open} onClose={closeInstallSheet} label="Installer KEVA">
        <InstallSheetContent platform={platform} reason={reason} />
      </BottomSheet>
    </div>
  );
}

const THIRD_BENEFIT: Record<InstallReason, string> = {
  general: "Tes paniers et tes favoris toujours sous la main",
  returning: "Tes paniers et tes favoris toujours sous la main",
  order: "Ta commande et tes boutiques à portée de main",
  vendor: "Les alertes de nouvelles commandes sur ton téléphone",
  notifications: "Les alertes de nouvelles commandes sur ton téléphone",
  partner: "Tes résultats de partenaire en un coup d'œil",
};

function InstallSheetContent({ platform, reason }: { platform: InstallPlatform; reason: InstallReason }) {
  if (platform === "installed") return <InstalledView />;

  return (
    <div className="px-3 pb-1">
      <SheetHeader />

      {platform === "in-app-android" || platform === "in-app-ios" ? (
        <InAppView platform={platform} />
      ) : (
        <>
          <ul className="mt-4 space-y-2.5">
            {["Ouvre KEVA en un appui depuis ton écran d'accueil", "Plein écran et plus rapide, comme une vraie appli", THIRD_BENEFIT[reason]].map(
              (benefit) => (
                <li key={benefit} className="flex items-start gap-2.5 text-sm text-encre">
                  <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-vert-actif/10 text-vert-actif">
                    <CheckIcon className="h-3 w-3" />
                  </span>
                  {benefit}
                </li>
              )
            )}
          </ul>

          {platform === "prompt" ? (
            <button
              type="button"
              onClick={async () => {
                const outcome = await promptInstall();
                // Acceptée : la feuille passe d'elle-même sur « C'est fait ! ».
                if (outcome === "dismissed") closeInstallSheet();
              }}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-vert-actif text-sm font-semibold text-ivoire transition hover:bg-vert-sapin"
            >
              <DownloadIcon className="h-5 w-5" />
              Installer maintenant
            </button>
          ) : platform === "ios" ? (
            <Steps
              steps={[
                {
                  icon: <ShareIcon className="h-5 w-5" />,
                  title: "Touche le bouton Partager",
                  text: "En bas de Safari. Sur les iPhone récents, il se trouve dans le menu ⋯",
                },
                {
                  icon: <PlusSquareIcon className="h-5 w-5" />,
                  title: "Choisis « Sur l'écran d'accueil »",
                  text: "Fais défiler la liste vers le bas si tu ne le vois pas",
                },
                {
                  icon: <CheckIcon className="h-4 w-4" />,
                  title: "Touche « Ajouter »",
                  text: "L'icône KEVA apparaît sur ton écran d'accueil",
                },
              ]}
              note="Tu ne trouves pas « Sur l'écran d'accueil » ? Ouvre d'abord cette page dans Safari."
            />
          ) : platform === "android" ? (
            <Steps
              steps={[
                {
                  icon: <MenuDotsIcon className="h-5 w-5" />,
                  title: "Touche le menu du navigateur",
                  text: "⋮ en haut à droite dans Chrome, ≡ en bas dans Samsung Internet",
                },
                {
                  icon: <DownloadIcon className="h-5 w-5" />,
                  title: "Choisis « Installer l'application »",
                  text: "ou « Ajouter à l'écran d'accueil »",
                },
                {
                  icon: <CheckIcon className="h-4 w-4" />,
                  title: "Confirme avec « Installer »",
                  text: "L'icône KEVA apparaît sur ton écran d'accueil",
                },
              ]}
            />
          ) : (
            <p className="mt-5 rounded-xl bg-brume p-4 text-sm leading-relaxed text-encre/80">
              Sur ordinateur, ouvre KEVA dans Chrome ou Edge, puis clique sur l&apos;icône
              d&apos;installation à droite de la barre d&apos;adresse. Le plus simple reste ton téléphone.
            </p>
          )}
        </>
      )}

      <button
        type="button"
        onClick={closeInstallSheet}
        className="mt-2 flex h-11 w-full items-center justify-center rounded-xl text-sm font-medium text-encre/70 transition hover:text-encre"
      >
        Plus tard
      </button>
    </div>
  );
}

function SheetHeader() {
  return (
    <div className="flex items-center gap-3 pt-1">
      {/* eslint-disable-next-line @next/next/no-img-element -- icône statique de l'appli */}
      <img src="/icons/icon-192.png" alt="" className="h-14 w-14 shrink-0 rounded-2xl shadow-[0_4px_12px_rgba(4,20,15,0.18)]" />
      <div className="min-w-0">
        <p className="font-display text-lg font-bold text-encre">Installer KEVA</p>
        <p className="text-sm text-encre/70">Gratuit et très léger, pas besoin de store</p>
      </div>
    </div>
  );
}

function Steps({
  steps,
  note,
}: {
  steps: { icon: React.ReactNode; title: string; text: string }[];
  note?: string;
}) {
  return (
    <div className="mt-5 rounded-2xl bg-brume p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-encre/60">En 3 étapes</p>
      <ol className="mt-3 space-y-3.5">
        {steps.map((step, index) => (
          <li key={step.title} className="flex items-start gap-3">
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ligne bg-white text-vert-actif">
              {step.icon}
              <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-vert-actif text-[11px] font-bold text-ivoire">
                {index + 1}
              </span>
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-semibold text-encre">{step.title}</p>
              <p className="text-xs leading-relaxed text-encre/70">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
      {note ? <p className="mt-4 border-t border-ligne pt-3 text-xs leading-relaxed text-encre/70">{note}</p> : null}
    </div>
  );
}

function InAppView({ platform }: { platform: "in-app-android" | "in-app-ios" }) {
  const [copied, setCopied] = useState<"idle" | "ok" | "failed">("idle");

  return (
    <>
      <p className="mt-4 rounded-xl bg-attention/10 p-3.5 text-sm leading-relaxed text-encre">
        Tu es dans le navigateur d&apos;une autre appli (TikTok, Instagram, Facebook…), qui ne permet pas
        d&apos;installer KEVA. Ouvre d&apos;abord la page dans {platform === "in-app-android" ? "Chrome" : "Safari"}.
      </p>

      {platform === "in-app-android" ? (
        <>
          <button
            type="button"
            onClick={() => {
              window.location.href = chromeIntentUrl();
            }}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-vert-actif text-sm font-semibold text-ivoire transition hover:bg-vert-sapin"
          >
            Ouvrir dans Chrome
          </button>
          <p className="mt-2 text-center text-xs leading-relaxed text-encre/70">
            Rien ne se passe ? Touche ⋮ ou ⋯ en haut à droite, puis « Ouvrir dans le navigateur ».
          </p>
        </>
      ) : (
        <Steps
          steps={[
            {
              icon: <MenuDotsIcon className="h-5 w-5" horizontal />,
              title: "Touche le menu ⋯",
              text: "En haut ou en bas à droite de l'écran",
            },
            {
              icon: <CompassIcon className="h-5 w-5" />,
              title: "Choisis « Ouvrir dans Safari »",
              text: "ou « Ouvrir dans le navigateur »",
            },
            {
              icon: <CheckIcon className="h-4 w-4" />,
              title: "Suis le guide d'installation",
              text: "Il s'affiche tout seul dans Safari",
            },
          ]}
        />
      )}

      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(installPageUrl());
            setCopied("ok");
          } catch {
            setCopied("failed");
          }
        }}
        className="mt-3 flex h-11 w-full items-center justify-center rounded-xl border border-ligne bg-white text-sm font-semibold text-encre transition hover:border-vert-actif hover:text-vert-actif"
      >
        {copied === "ok" ? "Lien copié : colle-le dans ton navigateur" : "Copier le lien"}
      </button>
      {copied === "failed" ? (
        <input
          readOnly
          value={installPageUrl()}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Lien à copier"
          className="mt-2 w-full rounded-lg border border-ligne bg-brume px-3 py-2 text-xs text-encre"
        />
      ) : null}
    </>
  );
}

function InstalledView() {
  return (
    <div className="px-3 pb-1 pt-2 text-center">
      <span aria-hidden="true" className="kv-pop mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-vert-actif text-ivoire">
        <CheckIcon className="h-7 w-7" />
      </span>
      <p className="mt-4 font-display text-lg font-bold text-encre">C&apos;est fait, KEVA est installée !</p>
      <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-encre/70">
        Retrouve l&apos;icône KEVA sur ton écran d&apos;accueil (ou dans la liste de tes applis) et ouvre-la comme
        n&apos;importe quelle appli.
      </p>
      <button
        type="button"
        onClick={closeInstallSheet}
        className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-vert-actif text-sm font-semibold text-ivoire transition hover:bg-vert-sapin"
      >
        Compris
      </button>
    </div>
  );
}

// Icônes dessinées à la main, même trait que le reste du projet.
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m4.5 10.5 3.5 3.5 7.5-8" />
    </svg>
  );
}

export function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="5" y="2" width="10" height="16" rx="2" />
      <path d="M10 6v6M7.5 9.5 10 12l2.5-2.5" />
      <path d="M8.5 15.5h3" />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M10 12.5V2.5" />
      <path d="m6.5 6 3.5-3.5L13.5 6" />
      <path d="M6.5 8.5H5a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 5 17.5h10a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 15 8.5h-1.5" />
    </svg>
  );
}

function PlusSquareIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="3" width="14" height="14" rx="3" />
      <path d="M10 6.5v7M6.5 10h7" />
    </svg>
  );
}

function MenuDotsIcon({ className, horizontal = false }: { className?: string; horizontal?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      {horizontal ? (
        <>
          <circle cx="4.5" cy="10" r="1.7" />
          <circle cx="10" cy="10" r="1.7" />
          <circle cx="15.5" cy="10" r="1.7" />
        </>
      ) : (
        <>
          <circle cx="10" cy="4.5" r="1.7" />
          <circle cx="10" cy="10" r="1.7" />
          <circle cx="10" cy="15.5" r="1.7" />
        </>
      )}
    </svg>
  );
}

function CompassIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" />
      <path d="m12.8 7.2-1.6 4-4 1.6 1.6-4 4-1.6Z" />
    </svg>
  );
}
