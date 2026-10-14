"use client";

import { canOfferInstall, startInstall, type InstallReason } from "@/lib/pwa-install";
import { useInstallPlatform } from "@/lib/use-install";
import { DownloadIcon } from "@/components/install-sheet";

/**
 * Points d'entrée permanents « Installer l'appli » (13/10/2026) : pied de
 * page, page Compte, menu du tableau de bord vendeur, réglages des
 * notifications. Toujours trouvables, jamais envahissants — ils disparaissent
 * d'eux-mêmes quand KEVA est déjà installée, ou sur un ordinateur où
 * l'installation n'est pas proposée. Un appui : fenêtre officielle
 * d'installation si elle est prête, sinon le guide adapté au téléphone.
 */
export function InstallAppButton({
  variant,
  reason = "general",
}: {
  variant: "footer" | "sidebar" | "account" | "inline";
  reason?: InstallReason;
}) {
  const platform = useInstallPlatform();
  if (!canOfferInstall(platform)) return null;

  const onClick = () => void startInstall(reason);

  if (variant === "footer") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-ivoire/25 bg-white/5 px-4 py-2 text-sm font-semibold text-ivoire transition hover:bg-white/10"
      >
        <DownloadIcon className="h-4 w-4" />
        Installer l&apos;appli KEVA
      </button>
    );
  }

  if (variant === "sidebar") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-ivoire/70 hover:bg-white/5 hover:text-ivoire"
      >
        <DownloadIcon className="h-4 w-4" />
        Installer l&apos;appli
      </button>
    );
  }

  if (variant === "account") {
    return (
      <section>
        <h2 className="mb-2 font-display text-base font-semibold text-encre">Application</h2>
        <button
          type="button"
          onClick={onClick}
          className="flex w-full items-center gap-3 overflow-hidden rounded-xl border border-ligne bg-white px-4 py-3.5 text-left transition hover:bg-brume/50"
        >
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-vert-actif/10 text-vert-actif">
            <DownloadIcon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-encre">Installer KEVA sur mon téléphone</span>
            <span className="block text-xs text-encre/70">Ouvre KEVA en un appui, comme une vraie appli</span>
          </span>
          <span className="text-encre/30">›</span>
        </button>
      </section>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 inline-flex items-center gap-2 rounded-full bg-vert-actif px-4 py-2 text-sm font-semibold text-ivoire transition hover:bg-vert-sapin"
    >
      <DownloadIcon className="h-4 w-4" />
      Installer KEVA
    </button>
  );
}
