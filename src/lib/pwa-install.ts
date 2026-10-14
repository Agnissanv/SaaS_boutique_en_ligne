/**
 * Installation guidée de l'appli KEVA (PWA) — 13/10/2026, demande d'Isaac :
 * « la notification de Google n'apparaît pas toujours pour te dire de
 * l'installer [...] c'est un peu compliqué pour les gens. »
 *
 * Avant : on comptait uniquement sur la bannière automatique de Chrome, que
 * Chrome affiche quand il le décide (rarement), jamais sur iPhone, et jamais
 * dans les navigateurs intégrés de TikTok / Instagram / Facebook — d'où
 * arrivent une bonne partie des visiteurs (liens des vendeuses, de
 * l'influenceuse partenaire).
 *
 * Maintenant, KEVA décide elle-même du moment (voir `install-invite.tsx`) et
 * adapte la méthode au téléphone :
 * - « prompt » : Chrome / Edge / Samsung Internet ont préparé leur fenêtre
 *   d'installation officielle (`beforeinstallprompt`, capté très tôt par le
 *   script en ligne de `layout.tsx`) -> un seul appui sur notre bouton ;
 * - « ios » : Apple n'offre aucune installation en un clic -> guide en 3 étapes ;
 * - « android » : Android sans fenêtre prête (autre navigateur, ou Chrome qui
 *   ne l'a pas encore proposée) -> guide « menu > Installer » ;
 * - « in-app-* » : navigateur intégré d'une appli, où installer est
 *   impossible -> on fait ouvrir la page dans le vrai navigateur ;
 * - « installed » : déjà ouverte comme appli, ou installée depuis ici ;
 * - « unsupported » : ordinateur sans fenêtre d'installation -> on ne
 *   propose rien (KEVA vise le téléphone).
 *
 * Module sans état React : un petit magasin externe lu avec
 * `useSyncExternalStore`, pour que le bouton du pied de page, la carte
 * d'invitation et la feuille d'installation voient tous la même chose.
 */

export type InstallPlatform =
  | "installed"
  | "prompt"
  | "ios"
  | "android"
  | "in-app-android"
  | "in-app-ios"
  | "unsupported";

/** Pourquoi on propose l'installation — adapte le texte de la feuille. */
export type InstallReason = "general" | "order" | "returning" | "vendor" | "partner" | "notifications";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    /** Posé par le script en ligne de `layout.tsx` (voir `INSTALL_CAPTURE_SCRIPT`). */
    __kevaInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

/** Événement interne émis à chaque changement (fenêtre prête, appli installée...). */
const CHANGE_EVENT = "keva:install-change";
const INSTALLED_KEY = "keva_app_installed";
const INVITE_KEY = "keva_install_invite";
const INVITE_SEEN_SESSION_KEY = "keva_install_invite_vue";
const VISITS_KEY = "keva_visites";
const VISIT_COUNTED_SESSION_KEY = "keva_visite_comptee";

/** Paramètre d'URL qui ouvre directement la feuille d'installation (lien « Ouvrir dans Chrome »). */
export const INSTALL_QUERY_PARAM = "installer";

/**
 * Script exécuté dès le chargement de la page, avant React : Chrome peut
 * envoyer `beforeinstallprompt` avant que l'appli ne soit prête à
 * l'écouter. `preventDefault()` retire la mini-bannière automatique de
 * Chrome — c'est KEVA qui choisit le moment désormais ; l'option reste
 * disponible dans le menu de Chrome.
 */
export const INSTALL_CAPTURE_SCRIPT = `(function(){function c(){window.dispatchEvent(new Event("${CHANGE_EVENT}"))}window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__kevaInstallPrompt=e;c()});window.addEventListener("appinstalled",function(){window.__kevaInstallPrompt=null;try{localStorage.setItem("${INSTALLED_KEY}","1")}catch(_){}c()})})();`;

function emitChange() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function safeGet(storage: "local" | "session", key: string): string | null {
  try {
    return (storage === "local" ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: "local" | "session", key: string, value: string) {
  try {
    (storage === "local" ? localStorage : sessionStorage).setItem(key, value);
  } catch {
    // Navigation privée / stockage bloqué : la règle concernée ne s'applique
    // simplement pas, rien de bloquant.
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function getInstallPlatform(): InstallPlatform {
  if (isStandalone()) return "installed";
  // Une fenêtre prête prime sur le souvenir d'une installation : Chrome ne
  // la propose que si l'appli n'est PAS installée (désinstallée depuis ?).
  if (window.__kevaInstallPrompt) return "prompt";
  if (safeGet("local", INSTALLED_KEY) === "1") return "installed";

  const ua = navigator.userAgent;
  const isIOS =
    /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const inApp =
    /FBAN|FBAV|FB_IAB|Instagram|TikTok|musical_ly|Bytedance|Snapchat|Line\/|LinkedInApp/i.test(ua) ||
    (isAndroid && /; wv\)/.test(ua));

  if (inApp && (isIOS || isAndroid)) return isIOS ? "in-app-ios" : "in-app-android";
  if (isIOS) return "ios";
  if (isAndroid) return "android";
  return "unsupported";
}

export function getServerInstallPlatform(): InstallPlatform {
  return "unsupported";
}

export function subscribeInstallPlatform(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    media.removeEventListener("change", callback);
  };
}

/** L'installation peut-elle être proposée sur cet appareil ? */
export function canOfferInstall(platform: InstallPlatform): boolean {
  return platform !== "installed" && platform !== "unsupported";
}

/**
 * Ouvre la fenêtre d'installation officielle (Chrome, Edge, Samsung
 * Internet). Un événement `beforeinstallprompt` ne sert qu'une fois : Chrome
 * en renverra un autre plus tard si l'utilisateur a refusé.
 */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = window.__kevaInstallPrompt;
  if (!event) return "unavailable";
  window.__kevaInstallPrompt = null;
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === "accepted") safeSet("local", INSTALLED_KEY, "1");
    return outcome;
  } catch {
    return "unavailable";
  } finally {
    emitChange();
  }
}

/**
 * Lien qui rouvre la page courante dans Chrome depuis le navigateur intégré
 * d'une appli Android (TikTok, Instagram, Facebook...), avec la feuille
 * d'installation ouverte à l'arrivée.
 */
export function chromeIntentUrl(): string {
  const url = new URL(window.location.href);
  url.searchParams.set(INSTALL_QUERY_PARAM, "1");
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url.toString())};end`;
}

/** Lien de la page courante qui ouvre la feuille d'installation (à coller dans Safari). */
export function installPageUrl(): string {
  const url = new URL(window.location.href);
  url.searchParams.set(INSTALL_QUERY_PARAM, "1");
  return url.toString();
}

// ---------------------------------------------------------------------------
// Feuille d'installation : un seul exemplaire monté dans `layout.tsx`
// (`InstallSheetHost`), ouvert depuis n'importe quel bouton du site.
// ---------------------------------------------------------------------------

type SheetState = { open: boolean; reason: InstallReason };
let sheetState: SheetState = { open: false, reason: "general" };
const sheetListeners = new Set<() => void>();

export function openInstallSheet(reason: InstallReason = "general") {
  sheetState = { open: true, reason };
  sheetListeners.forEach((listener) => listener());
}

export function closeInstallSheet() {
  sheetState = { ...sheetState, open: false };
  sheetListeners.forEach((listener) => listener());
}

export function subscribeInstallSheet(callback: () => void): () => void {
  sheetListeners.add(callback);
  return () => sheetListeners.delete(callback);
}

export function getInstallSheetState(): SheetState {
  return sheetState;
}

const CLOSED_SHEET: SheetState = { open: false, reason: "general" };
export function getServerInstallSheetState(): SheetState {
  return CLOSED_SHEET;
}

/**
 * Bouton « Installer » (carte d'invitation, pied de page, menus) : la
 * fenêtre officielle en un appui quand elle est prête, sinon le guide
 * adapté au téléphone.
 */
export async function startInstall(reason: InstallReason = "general") {
  if (window.__kevaInstallPrompt) {
    const outcome = await promptInstall();
    // Installée : la feuille affiche « C'est fait ! » et où trouver l'icône.
    if (outcome === "accepted") openInstallSheet(reason);
    if (outcome !== "unavailable") return;
  }
  openInstallSheet(reason);
}

// ---------------------------------------------------------------------------
// Invitation aux moments choisis (`install-invite.tsx`) : jamais encombrante.
//  - « Plus tard » : plus d'invitation pendant 14 jours ;
//  - « Ne plus me le proposer » : plus jamais (le bouton du pied de page, du
//    compte et des menus reste disponible) ;
//  - une seule invitation par visite ;
//  - « 3e visite » : visites comptées une fois par session de navigation.
// ---------------------------------------------------------------------------

const SNOOZE_DAYS = 14;

type InviteMemory = { snoozedUntil?: number; never?: boolean };

function readInviteMemory(): InviteMemory {
  try {
    return JSON.parse(safeGet("local", INVITE_KEY) ?? "{}") as InviteMemory;
  } catch {
    return {};
  }
}

export function canShowInvite(): boolean {
  if (!canOfferInstall(getInstallPlatform())) return false;
  if (safeGet("session", INVITE_SEEN_SESSION_KEY) === "1") return false;
  const memory = readInviteMemory();
  if (memory.never) return false;
  return !memory.snoozedUntil || Date.now() >= memory.snoozedUntil;
}

export function markInviteShown() {
  safeSet("session", INVITE_SEEN_SESSION_KEY, "1");
}

export function snoozeInvite() {
  safeSet("local", INVITE_KEY, JSON.stringify({ snoozedUntil: Date.now() + SNOOZE_DAYS * 86_400_000 }));
}

export function neverInvite() {
  safeSet("local", INVITE_KEY, JSON.stringify({ never: true }));
}

/** Compte la visite en cours (une fois par session de navigation). */
export function registerVisit() {
  if (safeGet("session", VISIT_COUNTED_SESSION_KEY) === "1") return;
  safeSet("session", VISIT_COUNTED_SESSION_KEY, "1");
  safeSet("local", VISITS_KEY, String(getVisitCount() + 1));
}

export function getVisitCount(): number {
  return Number(safeGet("local", VISITS_KEY) ?? "0") || 0;
}
