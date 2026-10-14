"use client";

import { useSyncExternalStore } from "react";
import {
  getInstallPlatform,
  getInstallSheetState,
  getServerInstallPlatform,
  getServerInstallSheetState,
  subscribeInstallPlatform,
  subscribeInstallSheet,
} from "@/lib/pwa-install";

/** Méthode d'installation de cet appareil (voir `pwa-install.ts`) ; « unsupported » côté serveur. */
export function useInstallPlatform() {
  return useSyncExternalStore(subscribeInstallPlatform, getInstallPlatform, getServerInstallPlatform);
}

export function useInstallSheet() {
  return useSyncExternalStore(subscribeInstallSheet, getInstallSheetState, getServerInstallSheetState);
}
