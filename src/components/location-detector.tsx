"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { findNearestLocation } from "@/lib/geo/ci-locations";
import {
  VISITOR_LOCATION_COOKIE,
  VISITOR_LOCATION_MAX_AGE_SECONDS,
  serializeVisitorLocation,
} from "@/lib/geo/visitor-location";

/**
 * Détection silencieuse de la position du visiteur pour le tri par
 * proximité de la marketplace (01/10/2026, demande d'Isaac : "le navigateur
 * connaît déjà sa position [...] il n'a pas besoin qu'on lui repose la
 * question"). Monté une seule fois dans le layout racine, même principe que
 * `RegisterServiceWorker`.
 *
 * Précision importante (pas un détail technique mineur) : le navigateur
 * connaît la position de l'utilisateur, mais `navigator.geolocation` exige
 * TOUJOURS que le visiteur accorde la permission au moins une fois — c'est
 * une règle de confidentialité imposée par tous les navigateurs, impossible
 * à contourner même involontairement. "Silencieux" ici veut dire : on ne
 * construit aucune bannière/popup KEVA pour le demander nous-mêmes, on
 * déclenche directement la demande native du navigateur dès l'arrivée sur le
 * site, sans attendre une action du visiteur. Une fois la permission
 * accordée (ou refusée) une première fois, le navigateur s'en souvient lui
 * -même — ce composant ne redemande rien tant que le cookie `keva_loc` est
 * encore valide (30 jours).
 *
 * Ne bloque jamais l'affichage : la page se charge et s'affiche normalement
 * avec l'ordre par défaut, puis se rafraîchit silencieusement (`router.
 * refresh()`) si une position a pu être résolue. Refus, navigateur sans
 * support, ou timeout : rien ne se passe, aucune erreur visible, aucun
 * produit masqué (voir locationTierOf, src/lib/marketplace/ranking.ts) —
 * conforme à la consigne explicite d'Isaac ("si ce n'est pas possible, les
 * autres s'affichent sans problème").
 */
export function LocationDetector() {
  const router = useRouter();

  useEffect(() => {
    if (document.cookie.includes(`${VISITOR_LOCATION_COOKIE}=`)) return;
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nearest = findNearestLocation(position.coords.latitude, position.coords.longitude);
        document.cookie = `${VISITOR_LOCATION_COOKIE}=${serializeVisitorLocation(nearest)}; path=/; max-age=${VISITOR_LOCATION_MAX_AGE_SECONDS}; samesite=lax`;
        router.refresh();
      },
      () => {
        // Refusé/indisponible — pas de cookie posé, donc on retentera (sans
        // gêner personne) au prochain chargement plutôt que de mémoriser un
        // refus : un visiteur qui change d'avis dans son navigateur doit
        // pouvoir profiter du tri par proximité sans vider ses cookies.
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60 * 60 * 1000 }
    );
  }, [router]);

  return null;
}
