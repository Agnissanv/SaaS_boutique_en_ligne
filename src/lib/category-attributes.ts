import type { CategoryValue } from "@/lib/categories";

/**
 * Spécifications dynamiques par catégorie — demandé par Isaac le 22/09/2026 :
 * jusqu'ici le formulaire "Ajouter un produit" affichait exactement les mêmes
 * champs quelle que soit la catégorie choisie (un ordinateur et une robe
 * partageaient le même formulaire). Décision explicite prise avec Isaac avant
 * de coder :
 * 1. Démarré sur 4 grandes familles (Mode, Beauté & Santé,
 *    Électronique/Téléphonie/Informatique/Électroménager, Alimentation &
 *    Maison), puis étendu le même jour, une fois ce premier lot validé par
 *    Isaac ("ok c'est bon, on peut étendre aux 20 autres catégories"), aux
 *    9 catégories restantes qui s'y prêtent : Sport & Loisirs, Auto & Moto,
 *    Bébé & Puériculture, Jouets & Jeux, Bricolage & Jardin, Papeterie &
 *    Fournitures, Livres & Culture, Décoration, Cuisine & Arts de la table.
 *    Seule `autre` reste volontairement sans champ dédié — repli générique
 *    par nature, cf. son commentaire dans categories.ts.
 * 2. Isaac a validé "je propose, tu corriges" pour le CONTENU des champs :
 *    la liste ci-dessous est une proposition (inspirée des standards du
 *    secteur/Jumia et du contexte ivoirien), à ajuster avec lui plutôt qu'une
 *    vérité déjà figée.
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
// "Marque" — ajouté le 22/09/2026 à TOUTES les catégories (sauf Livres &
// Culture, qui a déjà l'équivalent avec "Éditeur") à la demande d'Isaac :
// "peu importe le produit, il doit avoir une marque [...] tu peux faire
// apparaître une marque dans tout [...] c'est juste le placeholder qui va
// changer". Fonction plutôt que constante unique : même clé/label partout
// (une seule vraie notion de "marque", cohérente pour l'affichage et un futur
// filtre marketplace), mais un exemple différent par catégorie — un
// smartphone et une paire de baskets n'ont pas les mêmes marques usuelles.
function marqueField(placeholder: string): CategoryAttributeField {
  return { key: "marque", label: "Marque", type: "text", placeholder };
}
const GARANTIE_FIELD: CategoryAttributeField = {
  key: "garantie",
  label: "Garantie",
  type: "text",
  placeholder: "Ex : 12 mois constructeur",
};
const DIMENSIONS_FIELD: CategoryAttributeField = {
  key: "dimensions",
  label: "Dimensions",
  type: "text",
  placeholder: "Ex : 40 x 30 x 20 cm",
};
const AGE_RECOMMANDE_FIELD: CategoryAttributeField = {
  key: "age_recommande",
  label: "Âge recommandé",
  type: "text",
  placeholder: "Ex : 0-6 mois, 3-5 ans...",
};

const MODE_DESCRIPTION_PLACEHOLDER = "Matière, coupe, entretien...";

const BEAUTE_SANTE_CONTENANCE: CategoryAttributeField = {
  key: "contenance",
  label: "Contenance",
  type: "text",
  placeholder: "Ex : 50 ml, 100 g",
};

export const CATEGORY_FORM_COPY: Partial<Record<CategoryValue, CategoryFormCopy>> = {
  // ---------- Mode / chaussures / bijoux ----------
  mode: {
    titlePlaceholder: "Ex : Robe wax bleue",
    descriptionPlaceholder: MODE_DESCRIPTION_PLACEHOLDER,
    attributes: [marqueField("Ex : Nike, Zara, Marque locale..."), MATIERE_FIELD, GENRE_FIELD, SAISON_FIELD],
  },
  mode_femme: {
    titlePlaceholder: "Ex : Robe wax bleue pour femme",
    descriptionPlaceholder: MODE_DESCRIPTION_PLACEHOLDER,
    attributes: [marqueField("Ex : Nike, Zara, Marque locale..."), MATIERE_FIELD, GENRE_FIELD, SAISON_FIELD],
  },
  mode_homme: {
    titlePlaceholder: "Ex : Chemise en lin manches longues",
    descriptionPlaceholder: MODE_DESCRIPTION_PLACEHOLDER,
    attributes: [marqueField("Ex : Nike, Zara, Marque locale..."), MATIERE_FIELD, GENRE_FIELD, SAISON_FIELD],
  },
  mode_enfant: {
    titlePlaceholder: "Ex : Ensemble deux pièces enfant",
    descriptionPlaceholder: MODE_DESCRIPTION_PLACEHOLDER,
    attributes: [marqueField("Ex : Nike, Marque locale..."), MATIERE_FIELD, GENRE_FIELD, SAISON_FIELD],
  },
  chaussures: {
    titlePlaceholder: "Ex : Baskets en cuir blanches",
    descriptionPlaceholder: "Matière, entretien, pointures disponibles en variantes...",
    attributes: [marqueField("Ex : Nike, Bata, Marque locale..."), MATIERE_FIELD, GENRE_FIELD],
  },
  bijoux: {
    titlePlaceholder: "Ex : Collier en argent massif",
    descriptionPlaceholder: "Matière, entretien, occasion(s) recommandée(s)...",
    attributes: [marqueField("Ex : Fait main, Marque locale..."), MATIERE_FIELD, GENRE_FIELD],
  },

  // ---------- Beauté & Santé ----------
  beaute: {
    titlePlaceholder: "Ex : Crème hydratante au karité",
    descriptionPlaceholder: "Mode d'application, ingrédients, provenance...",
    attributes: [
      marqueField("Ex : Nivea, Shea Moisture, Marque locale..."),
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
      marqueField("Ex : Laboratoire, Marque locale..."),
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
      marqueField("Ex : Samsung, LG, Sony..."),
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
      marqueField("Ex : Samsung, Tecno, Infinix..."),
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
      marqueField("Ex : HP, Lenovo, Dell..."),
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
      marqueField("Ex : Samsung, LG, Nasco..."),
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
      marqueField("Ex : Nestlé, Fabrication artisanale/locale..."),
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
    attributes: [marqueField("Ex : Tefal, Fabrication artisanale..."), MATIERE_FIELD, DIMENSIONS_FIELD],
  },
  decoration: {
    titlePlaceholder: "Ex : Cadre photo en bois sculpté",
    descriptionPlaceholder: "Matière, dimensions, style...",
    attributes: [marqueField("Ex : Fabrication artisanale, Marque locale..."), MATIERE_FIELD, DIMENSIONS_FIELD],
  },
  cuisine: {
    titlePlaceholder: "Ex : Marmite en inox 24 cm",
    descriptionPlaceholder: "Matière, dimensions/capacité, entretien...",
    attributes: [
      marqueField("Ex : Tefal, Fabrication artisanale..."),
      MATIERE_FIELD,
      { key: "capacite", label: "Dimensions / Capacité", type: "text", placeholder: "Ex : 24 cm, 2 L..." },
    ],
  },

  // ---------- Sport & Loisirs ----------
  sport: {
    titlePlaceholder: "Ex : Ballon de football taille 5",
    descriptionPlaceholder: "Discipline, matière, entretien...",
    attributes: [
      marqueField("Ex : Nike, Adidas, Puma..."),
      { key: "discipline", label: "Discipline / Usage", type: "text", placeholder: "Ex : Football, Fitness, Randonnée..." },
      GENRE_FIELD,
    ],
  },

  // ---------- Auto & Moto ----------
  auto_moto: {
    titlePlaceholder: "Ex : Rétroviseur latéral Toyota Corolla",
    descriptionPlaceholder: "Compatibilité, état, montage...",
    // Deux notions de "marque" bien distinctes ici, toutes les deux utiles :
    // "marque" = la marque de LA PIÈCE elle-même (ex : Bosch fabrique la
    // pièce), "marque_compatible" = le véhicule sur lequel elle se monte
    // (ex : compatible Toyota). Un vendeur peut renseigner l'un, l'autre, ou
    // les deux.
    attributes: [
      marqueField("Ex : Bosch, Toyota (pièce d'origine), Marque locale..."),
      { key: "marque_compatible", label: "Marque compatible", type: "text", placeholder: "Ex : Toyota, Yamaha..." },
      { key: "modele_compatible", label: "Modèle compatible", type: "text", placeholder: "Ex : Corolla, Hilux..." },
      { key: "annee", label: "Année", type: "text", placeholder: "Ex : 2015-2020" },
      ETAT_FIELD,
    ],
  },

  // ---------- Bébé & Puériculture ----------
  bebe: {
    titlePlaceholder: "Ex : Body manches longues 6 mois",
    descriptionPlaceholder: "Âge recommandé, matière, entretien...",
    attributes: [marqueField("Ex : Pampers, Marque locale..."), AGE_RECOMMANDE_FIELD, MATIERE_FIELD, GENRE_FIELD],
  },

  // ---------- Jouets & Jeux ----------
  jouets: {
    titlePlaceholder: "Ex : Jeu de construction 200 pièces",
    descriptionPlaceholder: "Âge recommandé, contenu du coffret...",
    attributes: [marqueField("Ex : Marque locale, Import..."), AGE_RECOMMANDE_FIELD],
  },

  // ---------- Bricolage & Jardin ----------
  bricolage_jardin: {
    titlePlaceholder: "Ex : Perceuse sans fil 18V",
    descriptionPlaceholder: "Caractéristiques techniques, contenu du carton, garantie...",
    attributes: [
      marqueField("Ex : Bosch, Marque locale..."),
      { key: "puissance", label: "Puissance", type: "text", placeholder: "Ex : 1200 W, 18V" },
      GARANTIE_FIELD,
    ],
  },

  // ---------- Papeterie & Fournitures ----------
  papeterie: {
    titlePlaceholder: "Ex : Cahier grand format 200 pages",
    descriptionPlaceholder: "Format, nombre de pages/pièces, matière...",
    attributes: [
      marqueField("Ex : Bic, Marque locale..."),
      { key: "format", label: "Format", type: "text", placeholder: "Ex : A4, A5..." },
    ],
  },

  // ---------- Livres & Culture ----------
  // Pas de champ "Marque" ici : "Éditeur" en joue déjà le rôle pour un livre
  // (un livre n'a pas de "marque" au sens produit manufacturé).
  livres: {
    titlePlaceholder: "Ex : Une si longue lettre",
    descriptionPlaceholder: "Résumé, thème, état du livre...",
    attributes: [
      { key: "auteur", label: "Auteur", type: "text", placeholder: "Ex : Mariama Bâ" },
      { key: "editeur", label: "Éditeur", type: "text", placeholder: "Ex : Nouvelles Éditions Ivoiriennes" },
      {
        key: "langue",
        label: "Langue",
        type: "select",
        options: [
          { value: "francais", label: "Français" },
          { value: "anglais", label: "Anglais" },
          { value: "autre", label: "Autre" },
        ],
      },
    ],
  },

  // ---------- Autre ----------
  // Seule catégorie qui n'avait AUCUN champ dédié (repli générique par
  // nature) — Isaac a explicitement demandé que "Marque" apparaisse "dans
  // tout", elle passe donc de zéro à un seul champ, optionnel comme les
  // autres. Pas de placeholder/description dédiés : le générique convient
  // très bien à une catégorie qui n'a par définition rien de spécifique.
  autre: {
    attributes: [marqueField("Ex : Marque du produit, si applicable...")],
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
