/**
 * Lexique du moteur de recherche (09/10/2026).
 *
 * Deux usages :
 *  1. CATEGORY_KEYWORDS — quels mots désignent une catégorie. « vêtements »
 *     n'apparaît dans aucun titre, mais doit mener aux catégories Mode ;
 *     « ordinateur » doit mener à Informatique même si le vendeur a seulement
 *     écrit « HP 15-fd0581nk Intel Core i3 ».
 *  2. CONCEPTS — familles de mots interchangeables. Chercher « ordinateur »
 *     cherche aussi « pc », « laptop », « intel », « core i5 »... et classe
 *     donc un PC HP devant une clé USB, alors que les deux sont en Informatique.
 *
 * Écrit en français naturel (accents, pluriels, espaces) : tout est normalisé
 * au chargement par `tokenize`. Pour enrichir la recherche, il suffit
 * d'ajouter des mots ici — c'est le levier principal de la pertinence.
 */

export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  mode: [
    "mode", "vêtement", "habit", "habillement", "tenue", "fringue", "look", "style", "robe",
    "pantalon", "jean", "chemise", "t-shirt", "tshirt", "tee-shirt", "polo", "veste", "blouson",
    "manteau", "pull", "sweat", "sweatshirt", "hoodie", "short", "jupe", "ensemble", "costume",
    "pagne", "wax", "boubou", "kaftan", "tunique", "top", "débardeur", "legging", "survêtement",
    "jogging", "pyjama", "lingerie", "sous-vêtement", "chaussette", "casquette", "chapeau",
    "bonnet", "foulard", "écharpe", "uniforme",
  ],
  mode_femme: [
    "vêtement", "habit", "tenue", "femme", "dame", "robe", "jupe", "blouse", "crop top", "legging", "lingerie",
    "soutien-gorge", "culotte", "sac à main", "pochette", "chouchou", "élastique", "foulard",
    "pagne", "kaba", "ensemble femme", "talon", "escarpin",
  ],
  mode_homme: [
    "vêtement", "habit", "tenue", "homme", "monsieur", "costume", "cravate", "chemise", "polo", "boubou", "kaftan",
    "survêtement", "short", "jean homme", "ensemble homme", "caleçon", "boxer",
  ],
  mode_enfant: ["vêtement", "habit", "tenue", "enfant", "garçon", "fille", "kids", "junior", "uniforme scolaire", "tenue enfant"],
  chaussures: [
    "chaussure", "basket", "sneaker", "tennis", "sandale", "claquette", "mocassin", "escarpin",
    "talon", "botte", "bottine", "babouche", "tong", "soulier", "derby", "nike", "adidas", "puma",
  ],
  bijoux: [
    "bijou", "collier", "bracelet", "bague", "boucle d'oreille", "montre", "chaîne", "pendentif",
    "perle", "accessoire", "lunette", "sac", "ceinture", "portefeuille", "porte-clé",
  ],
  beaute: [
    "beauté", "cosmétique", "maquillage", "make-up", "rouge à lèvres", "gloss", "lèvre", "baume",
    "fond de teint", "mascara", "eyeliner", "vernis", "ongle", "faux ongles", "parfum",
    "eau de toilette", "crème", "lait corporel", "lotion", "savon", "gel douche", "shampoing",
    "shampooing", "après-shampoing", "cheveux", "perruque", "mèche", "tissage", "extension",
    "soin", "visage", "peau", "karité", "huile", "déodorant", "rasoir", "épilation", "sérum",
  ],
  sante_bienetre: [
    "santé", "bien-être", "vitamine", "complément alimentaire", "tisane", "masque",
    "thermomètre", "tensiomètre", "massage", "minceur", "régime", "pharmacie", "naturel", "bio",
  ],
  electronique: [
    "électronique", "écouteur", "casque", "audio", "enceinte", "haut-parleur", "bluetooth",
    "jbl", "télévision", "télé", "tv", "écran", "décodeur", "console", "playstation", "ps4",
    "ps5", "xbox", "manette", "caméra", "appareil photo", "drone", "montre connectée",
    "smartwatch", "power bank", "batterie externe", "chargeur", "câble", "airpods",
  ],
  telephonie: [
    "téléphone", "portable", "smartphone", "mobile", "iphone", "samsung", "galaxy", "tecno",
    "infinix", "itel", "xiaomi", "redmi", "huawei", "oppo", "android", "tablette", "ipad",
    "coque", "protection écran", "chargeur", "puce", "carte sim",
  ],
  informatique: [
    "informatique", "ordinateur", "ordi", "pc", "laptop", "notebook", "macbook", "mac", "imac",
    "desktop", "unité centrale", "pc de bureau", "portable", "clavier", "souris", "écran",
    "moniteur", "imprimante", "scanner", "clé usb", "usb", "disque dur", "ssd", "hdd", "ram",
    "mémoire", "carte mémoire", "carte sd", "hub", "adaptateur", "routeur", "modem", "wifi",
    "logiciel", "licence", "windows", "office", "antivirus", "hdmi", "processeur", "intel",
    "core i3", "core i5", "core i7", "ryzen", "hp", "dell", "lenovo", "asus", "acer", "toshiba",
    "apple",
  ],
  electromenager: [
    "électroménager", "frigo", "réfrigérateur", "congélateur", "climatiseur", "clim",
    "ventilateur", "lave-linge", "machine à laver", "micro-ondes", "four", "cuisinière",
    "plaque", "mixeur", "blender", "robot", "friteuse", "airfryer", "bouilloire",
    "fer à repasser", "aspirateur", "cafetière", "grille-pain",
  ],
  maison: [
    "maison", "intérieur", "meuble", "lit", "matelas", "drap", "couette", "oreiller", "rideau",
    "tapis", "canapé", "chaise", "table", "armoire", "rangement", "linge", "serviette",
    "nettoyage", "entretien", "lampe", "ampoule",
  ],
  decoration: [
    "décoration", "déco", "tableau", "cadre", "vase", "bougie", "miroir", "horloge",
    "plante artificielle", "coussin", "sticker",
  ],
  cuisine: [
    "cuisine", "ustensile", "casserole", "marmite", "poêle", "assiette", "verre", "tasse",
    "couvert", "couteau", "plat", "bol", "thermos", "gourde", "vaisselle",
  ],
  alimentation: [
    "alimentation", "nourriture", "aliment", "boisson", "jus", "eau", "café", "thé", "épice",
    "riz", "farine", "sucre", "biscuit", "chocolat", "snack", "attiéké", "poisson", "viande",
    "fruit", "légume", "bissap", "gingembre",
  ],
  bebe: [
    "bébé", "nourrisson", "couche", "biberon", "poussette", "landau", "tétine", "lait bébé",
    "layette", "body", "porte-bébé",
  ],
  jouets: ["jouet", "jeu", "poupée", "peluche", "lego", "puzzle", "voiture télécommandée", "jeu de société"],
  sport: [
    "sport", "fitness", "musculation", "haltère", "yoga", "ballon", "maillot", "football",
    "foot", "vélo", "running", "gym",
  ],
  auto_moto: [
    "auto", "voiture", "moto", "pneu", "casque moto", "pièce détachée", "huile moteur",
    "batterie voiture", "accessoire auto",
  ],
  bricolage_jardin: [
    "bricolage", "outil", "perceuse", "tournevis", "marteau", "jardin", "jardinage", "arrosoir",
    "tuyau", "peinture", "quincaillerie",
  ],
  papeterie: [
    "papeterie", "fourniture", "cahier", "stylo", "crayon", "cartable", "sac à dos", "classeur",
    "agenda", "calculatrice", "école", "scolaire", "bureau",
  ],
  livres: ["livre", "roman", "bd", "manga", "magazine", "culture", "bible", "coran"],
  autre: [],
};

/**
 * Familles de mots équivalents. Un mot de la requête présent dans une famille
 * fait chercher tous les autres membres (avec un poids moindre qu'une
 * correspondance exacte).
 */
export const CONCEPTS: string[][] = [
  [
    "ordinateur", "ordi", "pc", "laptop", "notebook", "macbook", "imac", "desktop",
    "unité centrale", "pc de bureau", "intel", "core i3", "core i5", "core i7", "ryzen",
    "hp", "dell", "lenovo", "asus", "acer", "toshiba",
  ],
  ["téléphone", "smartphone", "portable", "mobile", "iphone", "android", "samsung", "tecno", "infinix", "itel", "redmi"],
  ["vêtement", "habit", "habillement", "tenue", "fringue", "tissu"],
  ["t-shirt", "tshirt", "tee-shirt", "tee"],
  ["sweat", "sweatshirt", "hoodie", "pull"],
  ["chaussure", "basket", "sneaker", "tennis", "soulier"],
  ["sac", "sacoche", "pochette", "cabas"],
  ["clé usb", "usb", "flash", "stockage"],
  ["frigo", "réfrigérateur"],
  ["clim", "climatiseur"],
  ["télé", "télévision", "tv"],
  ["écouteur", "casque", "airpods", "audio"],
  ["parfum", "eau de toilette", "eau de parfum", "fragrance"],
  ["rouge à lèvres", "gloss", "lèvre", "baume"],
  ["perruque", "mèche", "tissage", "extension"],
  ["montre", "smartwatch"],
  ["licence", "logiciel", "windows", "office", "activation"],
];
