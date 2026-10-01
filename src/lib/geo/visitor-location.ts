import type { VisitorLocation } from "@/lib/marketplace/ranking";

/**
 * Format partagé du cookie de localisation visiteur — posé côté client par
 * `LocationDetector` (voir src/components/location-detector.tsx, résolution
 * de `navigator.geolocation` vers la ville/commune connue la plus proche via
 * `findNearestLocation`), lu côté serveur par `src/app/page.tsx` pour trier
 * la marketplace par proximité (voir ranking.ts). Un seul endroit pour le nom
 * du cookie et son format d'encodage, pour que les deux còtés restent
 * synchronisés si l'un des deux change.
 *
 * 30 jours : assez long pour ne pas redemander la position à chaque visite
 * (la permission navigateur, elle, est de toute façon mémorisée par le
 * navigateur lui-même — ce cookie évite seulement de refaire le calcul de
 * ville la plus proche et un rafraîchissement de page à chaque chargement),
 * assez court pour qu'un visiteur qui voyage retrouve un classement à jour
 * au bout d'un mois.
 */
export const VISITOR_LOCATION_COOKIE = "keva_loc";
export const VISITOR_LOCATION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** `"Abidjan|Cocody"` ou `"Yamoussoukro|"` (pas de commune hors Abidjan). */
export function serializeVisitorLocation(location: VisitorLocation): string {
  return `${encodeURIComponent(location.ville)}|${location.commune ? encodeURIComponent(location.commune) : ""}`;
}

export function parseVisitorLocationCookie(raw: string | undefined | null): VisitorLocation | null {
  if (!raw) return null;
  const [villeRaw, communeRaw] = raw.split("|");
  if (!villeRaw) return null;
  try {
    const ville = decodeURIComponent(villeRaw);
    const commune = communeRaw ? decodeURIComponent(communeRaw) : null;
    return { ville, commune };
  } catch {
    // Cookie corrompu/mal formé (jamais notre propre écriture) — ignoré
    // silencieusement, même traitement que "position inconnue" (voir
    // locationTierOf, jamais bloquant).
    return null;
  }
}
