import type { CategoryValue } from "@/lib/categories";

/**
 * Spécifications dynamiques par catégorie — demandé par Isaac le 22/09/2026 :
 * jusqu'ici le formulaire "Ajouter un produit" affichait exactement les mêmes
 * champs quelle que soit la catégorie choisie (un ordinateur et une robe
 * partageaient le même formulaire). Décision explicite prise avec Isaac avant
 * de coder :
 * 1. On démarre sur 4 grandes familles (celles qu'il avait lui-même évoquées
 *    le 22/09 en différant ce chantier) plutôt que les 24 catégories d'un
 *    coup : Mode (mode/mode_femme/mode_homme/mode_enfant/chaussures/bijoux),
 *    Beauté & Santé, Électronique/Téléphonie/Informatique/Électroménager,
 *    Alimentation & Maison. Les autres catégories (sport, auto_moto, bebe,
 *    jouets, bricolage_jardin, papeterie, livres, decoration, cuisine,
 *    autre...) n'ont pour l'instant aucun champ dédié — le formulaire reste
 *    générique pour elles, comme avant.
 * 2. Isaac a validé "je propose, tu corriges" pour le CONTENU des champs :
 *    la liste ci-dessous est une première proposition (inspirée des standards
 *    du secteur/Jumia), à ajuster avec lui plutôt qu'une vérité déjà figée.
 * 3. Explicitement PAS de filtres marketplace pour l'instant (chantier
 *    séparé, remis à plus tard par Isaac) — ces champs ne servent qu'au
 *    formulaire vendeur et à l'affichage sur la fiche produit publique.
 *
 * Volontairement DISTINCT du système de variantes (`VariantGroups`,
 * product-form.tsx) : une variante est un CHOIX du client au moment de
 * l'achat (taille, couleur — déjà géré, générique, inchangé ici). Un attribut
 * de cette liste est une INFORMATION descriptive du produit (RAM, poids net,
 * matière...), jamais un choix qui affecte le panier.
 *
 * Stockage : une seule colonne `products.attributes` (jsonb, clé -> valeur
 * texte), plutôt qu'une table dédiée par catégorie — même philosophie que le
 * reste du projet (garder le modèle de données simple, cf. le choix similaire
 * documenté sur `product_variants` dans decisions-techniques.md). Ajouter un
 * champ à une catégorie ne demande donc qu'une modification de ce fichier,
 * jamais de migration.
 */

export type CategoryAttributeField = {
  /** Clé technique stockée dans `products.attributes` (ex: "ram"). */
  key: string;
  /** Libellé affiché au vendeur ET sur la fiche produit publique. */
  label: string;
  type: "text" | "select";
  /** Texte d'exemple, pour les champs texte uniquement. */
  placeholder?: string;
  /** Options possibles, pour les champs liste déroulante uniquement. */
  options?: { value: string; label: string }[];
};

type CategoryFormCopy = {
  /** Remplace le placeholder générique du champ "Titre du produit". */
  titlePlaceholder?: string;
  /** Remplace le placeholder générique du champ "Description". */
  descriptionPlaceholder?: string;
  /** Champs de spécifications propres à cette catégorie, dans l'ordre d'affichage. */
  attributes?: CategoryAttributeField[];
};

// Champs réutilisés tels quels par plusieurs catégories d'une même famille —
// évite de répéter la même définition (label, options...) à plusieurs
// endroits, qui finiraient par diverger avec le temps.
const MATIERE_FIELD: CategoryAttributeField = {
  key: "matiere",
  label: "Matière",
  type: "text",
  placeholder: "Ex : Coton, Wax, Cuir, Or, Argent...",
};
const GENRE_FIELD: CategoryAttributeField = {
  key: "genre",
  label: "Genre",
  type: "select",
  options: [
    { value: "femme", label: "Femme" },
    { value: "homme", label: "Homme" },
    { value: "enfant", label: "Enfant" },
    { value: "unisexe", label: "Unisexe" },
  ],
};
const SAISON_FIELD: CategoryAttributeField = {
  key: "saison",
  label: "Saison",
  type: "select",
  options: [
    { value: "toute_saison", label: "Toutes saisons" },
    { value: "saison_seche", label: "Saison sèche" },
    { value: "saison_pluies", label: "Saison des pluies" },
  ],
};
const ETAT_FIELD: CategoryAttributeField = {
  key: "etat",
  label: "État",
  type: "select",
  options: [
    { value: "neuf", label: "Neuf" },
    { value: "reconditionne", label: "Reconditionné" },
    { value: "occasion", label: "Occasion" },
  ],
};
const MARQUE_FIELD: CategoryAttributeField = {
  key: "marque",
  label: "Marque",
  type: "text",
  placeholder: "Ex : Samsung, HP, Lenovo...",
};
const GARANTIE_FIELD: CategoryAttributeField = {
  key: "garantie",
  label: "Garantie",
  type: "text",
  placeholder: "Ex : 12 mois constructeur",
};

const MODE_ATTRIBUTES = [MATIERE_FIELD, GENRE_FIELD, SAISON_FIELD];
const MODE_COPY: CategoryFormCopy = {
  descriptionPlaceholder: "Matière, coupe, entretien...",
  attributes: MODE_ATTRIBUTES,
};

const BEAUTE_SANTE_CONTENANCE: CategoryAttributeField = {
  key: "contenance",
  label: "Contenance",
  type: "text",
  placeholder: "Ex : 50 ml, 100 g",
};

export const CATEGORY_FORM_COPY: Partial<Record<CategoryValue, CategoryFormCopy>> = {
  // ---------- Mode / chaussures / bijoux ----------
  mode: { ...MODE_COPY, titlePlaceholder: "Ex : Robe wax bleue" },
  mode_femme: { ...MODE_COPY, titlePlaceholder: "Ex : Robe wax bleue pour femme" },
  mode_homme: { ...MODE_COPY, titlePlaceholder: "Ex : Chemise en lin manches longues" },
  mode_enfant: { ...MODE_COPY, titlePlaceholder: "Ex : Ensemble deux pièces enfant" },
  chaussures: {
    titlePlaceholder: "Ex : Baskets en cuir blanches",
    descriptionPlaceholder: "Matière, entretien, pointures disponibles en variantes...",
    attributes: [MATIERE_FIELD, GENRE_FIELD],
  },
  bijoux: {
    titlePlaceholder: "Ex : Collier en argent massif",
    descriptionPlaceholder: "Matière, entretien, occasion(s) recommandée(s)...",
    attributes: [MATIERE_FIELD, GENRE_FIELD],
  },

  // ---------- Beauté & Santé ----------
  beaute: {
    titlePlaceholder: "Ex : Crème hydratante au karité",
    descriptionPlaceholder: "Mode d'application, ingrédients, provenance...",
    attributes: [
      BEAUTE_SANTE_CONTENANCE,
      {
        key: "type_peau",
        label: "Type de peau",
        type: "select",
        options: [
          { value: "tous_types", label: "Tous types" },
          { value: "grasse", label: "Peau grasse" },
          { value: "seche", label: "Peau sèche" },
          { value: "mixte", label: "Peau mixte" },
          { value: "sensible", label: "Peau sensible" },
        ],
      },
      {
        key: "ingredients_cles",
        label: "Ingrédients clés",
        type: "text",
        placeholder: "Ex : Karité, Aloe vera, Huile de coco...",
      },
    ],
  },
  sante_bienetre: {
    titlePlaceholder: "Ex : Complément alimentaire vitamine C",
    descriptionPlaceholder: "Composition, posologie, précautions d'emploi...",
    attributes: [
      BEAUTE_SANTE_CONTENANCE,
      {
        key: "usage",
        label: "Usage recommandé",
        type: "text",
        placeholder: "Ex : 1 comprimé par jour",
      },
    ],
  },

  // ---------- Électronique / Téléphonie / Informatique / Électroménager ----------
  electronique: {
    titlePlaceholder: "Ex : Téléviseur LED 43 pouces",
    descriptionPlaceholder: "Caractéristiques techniques, contenu du carton, état...",
    attributes: [
      MARQUE_FIELD,
      ETAT_FIELD,
      {
        key: "caracteristiques",
        label: "Caractéristiques techniques",
        type: "text",
        placeholder: "Ex : Écran 43 pouces, Full HD",
      },
      GARANTIE_FIELD,
    ],
  },
  telephonie: {
    titlePlaceholder: "Ex : Smartphone Samsung Galaxy A14",
    descriptionPlaceholder: "Stockage, état, accessoires inclus...",
    attributes: [
      MARQUE_FIELD,
      ETAT_FIELD,
      { key: "stockage", label: "Stockage", type: "text", placeholder: "Ex : 128 Go" },
      { key: "ram", label: "RAM", type: "text", placeholder: "Ex : 4 Go" },
      GARANTIE_FIELD,
    ],
  },
  informatique: {
    titlePlaceholder: "Ex : Ordinateur portable HP i5 8 Go RAM",
    descriptionPlaceholder: "Processeur, RAM, stockage, état...",
    attributes: [
      MARQUE_FIELD,
      ETAT_FIELD,
      { key: "processeur", label: "Processeur", type: "text", placeholder: "Ex : Intel Core i5" },
      { key: "ram", label: "RAM", type: "text", placeholder: "Ex : 8 Go" },
      { key: "stockage", label: "Stockage", type: "text", placeholder: "Ex : 256 Go SSD" },
      GARANTIE_FIELD,
    ],
  },
  electromenager: {
    titlePlaceholder: "Ex : Réfrigérateur 2 portes 300 L",
    descriptionPlaceholder: "Puissance, capacité, garantie...",
    attributes: [
      MARQUE_FIELD,
      ETAT_FIELD,
      { key: "puissance", label: "Puissance", type: "text", placeholder: "Ex : 1200 W" },
      GARANTIE_FIELD,
    ],
  },

  // ---------- Alimentation & Maison ----------
  alimentation: {
    titlePlaceholder: "Ex : Miel pur de brousse 500g",
    descriptionPlaceholder: "Ingrédients, conservation, origine...",
    attributes: [
      { key: "poids_volume", label: "Poids / Volume net", type: "text", placeholder: "Ex : 500 g, 1 L" },
      { key: "origine", label: "Origine", type: "text", placeholder: "Ex : Produit local, Importé..." },
      {
        key: "conservation",
        label: "Conservation",
        type: "text",
        placeholder: "Ex : À conserver au frais, 6 mois après ouverture",
      },
    ],
  },
  maison: {
    titlePlaceholder: "Ex : Service à thé en céramique",
    descriptionPlaceholder: "Matière, dimensions, entretien...",
    attributes: [
      MATIERE_FIELD,
      { key: "dimensions", label: "Dimensions", type: "text", placeholder: "Ex : 40 x 30 x 20 cm" },
    ],
  },
};

const DEFAULT_TITLE_PLACEHOLDER = "Ex : Robe wax bleue";
const DEFAULT_DESCRIPTION_PLACEHOLDER = "Matière, coupe, entretien...";

export function getCategoryAttributeFields(category: string | null | undefined): CategoryAttributeField[] {
  if (!category) return [];
  return CATEGORY_FORM_COPY[category as CategoryValue]?.attributes ?? [];
}

export function getCategoryTitlePlaceholder(category: string | null | undefined): string {
  if (!category) return DEFAULT_TITLE_PLACEHOLDER;
  return CATEGORY_FORM_COPY[category as CategoryValue]?.titlePlaceholder ?? DEFAULT_TITLE_PLACEHOLDER;
}

export function getCategoryDescriptionPlaceholder(category: string | null | undefined): string {
  if (!category) return DEFAULT_DESCRIPTION_PLACEHOLDER;
  return (
    CATEGORY_FORM_COPY[category as CategoryValue]?.descriptionPlaceholder ?? DEFAULT_DESCRIPTION_PLACEHOLDER
  );
}

/** Libellé lisible pour une clé d'attribut d'une catégorie donnée, ou la clé elle-même en repli. */
export function getAttributeLabel(category: string | null | undefined, key: string): string {
  const field = getCategoryAttributeFields(category).find((f) => f.key === key);
  return field?.label ?? key;
}

/** Libellé lisible pour une VALEUR d'attribut de type "select" (ex: "grasse" -> "Peau grasse"). */
export function getAttributeValueLabel(
  category: string | null | undefined,
  key: string,
  value: string
): string {
  const field = getCategoryAttributeFields(category).find((f) => f.key === key);
  return field?.options?.find((o) => o.value === value)?.label ?? value;
}
