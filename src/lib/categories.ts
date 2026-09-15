/**
 * Catégories partagées boutique/produit (cf. cahier des charges §3.1.A.2 :
 * "Mode, Beauté, Électronique, Maison, Alimentation, Autre"). Une seule
 * source de vérité — précédemment dupliquée dans shop-form.tsx,
 * boutique/actions.ts et produits/product-form.tsx (constaté le 13/09/2026
 * en construisant la marketplace, qui a besoin de la même liste pour filtrer
 * tous les produits/boutiques de la plateforme).
 *
 * Étendue de 6 à 24 catégories le 15/09/2026 (retour d'Isaac : "on a des
 * concurrents bien musclés... nos catégories sont très petites pour une
 * grande marketplace", en observant la nouvelle page d'accueil par
 * catégories — voir "Refonte de la page d'accueil marketplace, round 2"
 * dans decisions-techniques.md). Les 6 valeurs d'origine (`mode`, `beaute`,
 * `electronique`, `maison`, `alimentation`, `autre`) gardent leur `value`
 * exacte : des boutiques/produits réels utilisent déjà ces valeurs, les
 * renommer aurait cassé leurs données. Les nouvelles catégories viennent
 * s'ajouter à côté plutôt que remplacer — un vendeur "Mode" existant reste
 * valide, un nouveau vendeur peut choisir plus précisément "Mode Femme".
 *
 * `autre` reste volontairement en dernière position (repli générique).
 *
 * Important : `shops.category` a une contrainte `check` en base
 * (`supabase/migrations/0001_init.sql`) qui liste explicitement les valeurs
 * autorisées — étendue en même temps dans
 * `supabase/migrations/0015_more_categories_and_bestsellers.sql`. Isaac doit
 * appliquer cette migration avant qu'un vendeur puisse choisir une des
 * nouvelles catégories pour sa boutique (même contrainte que toutes les
 * migrations précédentes). `products.category` n'a pas de contrainte en
 * base (simple `text`), donc aucune migration n'est nécessaire côté produit
 * pour utiliser les nouvelles valeurs.
 */
export const CATEGORIES = [
  { value: "mode", label: "Mode" },
  { value: "mode_femme", label: "Mode Femme" },
  { value: "mode_homme", label: "Mode Homme" },
  { value: "mode_enfant", label: "Mode Enfant" },
  { value: "chaussures", label: "Chaussures" },
  { value: "bijoux", label: "Bijoux & Accessoires" },
  { value: "beaute", label: "Beauté & Soins" },
  { value: "sante_bienetre", label: "Santé & Bien-être" },
  { value: "electronique", label: "Électronique" },
  { value: "telephonie", label: "Téléphonie" },
  { value: "informatique", label: "Informatique" },
  { value: "electromenager", label: "Électroménager" },
  { value: "maison", label: "Maison" },
  { value: "decoration", label: "Décoration" },
  { value: "cuisine", label: "Cuisine & Arts de la table" },
  { value: "alimentation", label: "Alimentation & Boissons" },
  { value: "bebe", label: "Bébé & Puériculture" },
  { value: "jouets", label: "Jouets & Jeux" },
  { value: "sport", label: "Sport & Loisirs" },
  { value: "auto_moto", label: "Auto & Moto" },
  { value: "bricolage_jardin", label: "Bricolage & Jardin" },
  { value: "papeterie", label: "Papeterie & Fournitures" },
  { value: "livres", label: "Livres & Culture" },
  { value: "autre", label: "Autre" },
] as const;

export type CategoryValue = (typeof CATEGORIES)[number]["value"];

export function isValidCategory(value: string): value is CategoryValue {
  return CATEGORIES.some((c) => c.value === value);
}

export function categoryLabel(value: string): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}
