/**
 * Localisation boutique/visiteur — ville + commune (Abidjan uniquement),
 * ajouté le 01/10/2026 (demande d'Isaac : "les produits doivent s'afficher
 * par rapport à la position de la personne la plus proche", façon Facebook
 * Marketplace). Réponse d'Isaac à la question posée ("ville seulement" vs
 * "GPS précis") : "ville et commune si possible".
 *
 * Nuance pas explicitement discutée avec Isaac mais nécessaire pour que
 * "commune" ait un sens : le découpage en communes ne s'applique qu'à
 * Abidjan (district autonome, ~13 communes/sous-préfectures) — les autres
 * grandes villes de Côte d'Ivoire (Korhogo, Yamoussoukro, Bouaké, citées par
 * Isaac lui-même...) sont des villes compactes sans ce découpage. D'où le
 * modèle : `commune` n'existe QUE pour Abidjan, `null` partout ailleurs.
 *
 * Approche "gratuite, sans clé API" (même philosophie que la position GPS de
 * livraison, voir migration 0006 et decisions-techniques.md) : pas de
 * géocodage inversé payant (Google Maps Geocoding API). À la place, un point
 * de référence (latitude/longitude approximative, connue publiquement) par
 * ville/commune, et un calcul de distance à vol d'oiseau (Haversine) côté
 * client pour trouver le point le plus proche de la position GPS du
 * visiteur — précision largement suffisante pour classer des boutiques par
 * proximité, pas pour de la navigation.
 *
 * Liste volontairement non exhaustive (les grandes villes + quelques villes
 * moyennes citées dans les documents KEVA ou connues pour avoir une activité
 * commerciale) plutôt qu'un découpage administratif complet (~200+
 * sous-préfectures) — à étendre si un vendeur signale que sa ville n'y est
 * pas (voir `findNearestLocation`, qui retombe toujours sur le point le plus
 * proche même imparfait, jamais une erreur).
 */

export type CiLocationPoint = {
  /** Nom affiché au vendeur/visiteur. */
  ville: string;
  /** Uniquement renseigné pour Abidjan — `null` pour toutes les autres villes. */
  commune: string | null;
  lat: number;
  lng: number;
};

/** Les 13 communes/sous-préfectures du District Autonome d'Abidjan. */
export const ABIDJAN_COMMUNES = [
  "Abobo",
  "Adjamé",
  "Anyama",
  "Attécoubé",
  "Bingerville",
  "Cocody",
  "Koumassi",
  "Marcory",
  "Plateau",
  "Port-Bouët",
  "Songon",
  "Treichville",
  "Yopougon",
] as const;

const ABIDJAN_COMMUNE_POINTS: CiLocationPoint[] = [
  { ville: "Abidjan", commune: "Abobo", lat: 5.4186, lng: -4.015 },
  { ville: "Abidjan", commune: "Adjamé", lat: 5.36, lng: -4.025 },
  { ville: "Abidjan", commune: "Anyama", lat: 5.4939, lng: -4.0511 },
  { ville: "Abidjan", commune: "Attécoubé", lat: 5.34, lng: -4.045 },
  { ville: "Abidjan", commune: "Bingerville", lat: 5.3558, lng: -3.8867 },
  { ville: "Abidjan", commune: "Cocody", lat: 5.36, lng: -3.98 },
  { ville: "Abidjan", commune: "Koumassi", lat: 5.295, lng: -3.955 },
  { ville: "Abidjan", commune: "Marcory", lat: 5.29, lng: -3.985 },
  { ville: "Abidjan", commune: "Plateau", lat: 5.32, lng: -4.02 },
  { ville: "Abidjan", commune: "Port-Bouët", lat: 5.255, lng: -3.935 },
  { ville: "Abidjan", commune: "Songon", lat: 5.3167, lng: -4.2667 },
  { ville: "Abidjan", commune: "Treichville", lat: 5.295, lng: -4.01 },
  { ville: "Abidjan", commune: "Yopougon", lat: 5.345, lng: -4.085 },
];

/** Grandes villes de Côte d'Ivoire hors Abidjan — pas de notion de commune. */
const OTHER_VILLE_POINTS: CiLocationPoint[] = [
  { ville: "Yamoussoukro", commune: null, lat: 6.8276, lng: -5.2893 },
  { ville: "Bouaké", commune: null, lat: 7.69, lng: -5.03 },
  { ville: "San-Pédro", commune: null, lat: 4.7467, lng: -6.6364 },
  { ville: "Korhogo", commune: null, lat: 9.4581, lng: -5.6296 },
  { ville: "Daloa", commune: null, lat: 6.877, lng: -6.4502 },
  { ville: "Man", commune: null, lat: 7.4125, lng: -7.5538 },
  { ville: "Gagnoa", commune: null, lat: 6.1319, lng: -5.9506 },
  { ville: "Abengourou", commune: null, lat: 6.7297, lng: -3.4964 },
  { ville: "Divo", commune: null, lat: 5.8372, lng: -5.3572 },
  { ville: "Agboville", commune: null, lat: 5.928, lng: -4.2155 },
  { ville: "Grand-Bassam", commune: null, lat: 5.2122, lng: -3.739 },
  { ville: "Soubré", commune: null, lat: 5.7858, lng: -6.5981 },
  { ville: "Odienné", commune: null, lat: 9.509, lng: -7.5667 },
  { ville: "Bondoukou", commune: null, lat: 8.0402, lng: -2.8 },
  { ville: "Ferkessédougou", commune: null, lat: 9.5975, lng: -5.1958 },
  { ville: "Séguéla", commune: null, lat: 7.9617, lng: -6.6719 },
  { ville: "Touba", commune: null, lat: 8.2833, lng: -7.6833 },
  { ville: "Dimbokro", commune: null, lat: 6.65, lng: -4.7064 },
  { ville: "Adzopé", commune: null, lat: 6.105, lng: -3.86 },
  { ville: "Sinfra", commune: null, lat: 6.6167, lng: -5.9167 },
  { ville: "Issia", commune: null, lat: 6.4939, lng: -6.5861 },
  { ville: "Tiassalé", commune: null, lat: 5.8989, lng: -4.8228 },
  { ville: "Guiglo", commune: null, lat: 6.55, lng: -7.4833 },
  { ville: "Toumodi", commune: null, lat: 6.5572, lng: -5.0167 },
  { ville: "Bouaflé", commune: null, lat: 6.9947, lng: -5.7406 },
  { ville: "Katiola", commune: null, lat: 8.1333, lng: -5.1 },
  { ville: "Boundiali", commune: null, lat: 9.5167, lng: -6.4833 },
  { ville: "Danané", commune: null, lat: 7.2642, lng: -8.1558 },
  { ville: "Aboisso", commune: null, lat: 5.4703, lng: -3.2067 },
  { ville: "Sassandra", commune: null, lat: 4.95, lng: -6.0833 },
  { ville: "Lakota", commune: null, lat: 5.8536, lng: -5.6761 },
  { ville: "Daoukro", commune: null, lat: 7.0583, lng: -3.9608 },
];

/** Toutes les villes affichées dans le `<select>` du formulaire boutique. */
export const CI_VILLES: string[] = [
  "Abidjan",
  ...OTHER_VILLE_POINTS.map((p) => p.ville),
];

const ALL_POINTS: CiLocationPoint[] = [...ABIDJAN_COMMUNE_POINTS, ...OTHER_VILLE_POINTS];

/** Distance à vol d'oiseau en kilomètres (formule de Haversine). */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Trouve la ville/commune connue la plus proche d'une position GPS — utilisé
 * côté visiteur (position du navigateur) pour déduire sa ville/commune sans
 * jamais appeler de service de géocodage externe. Toujours un résultat (le
 * point le plus proche, même lointain) : jamais d'erreur, cohérent avec le
 * principe "si ce n'est pas possible, les autres produits s'affichent sans
 * problème" — un visiteur hors de portée de tout point connu obtient juste
 * la ville la plus proche, pas un blocage.
 */
export function findNearestLocation(
  lat: number,
  lng: number
): { ville: string; commune: string | null; distanceKm: number } {
  let best = ALL_POINTS[0];
  let bestDistance = haversineKm(lat, lng, best.lat, best.lng);
  for (const point of ALL_POINTS.slice(1)) {
    const distance = haversineKm(lat, lng, point.lat, point.lng);
    if (distance < bestDistance) {
      best = point;
      bestDistance = distance;
    }
  }
  return { ville: best.ville, commune: best.commune, distanceKm: bestDistance };
}
