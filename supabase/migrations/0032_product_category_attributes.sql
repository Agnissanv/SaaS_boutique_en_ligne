-- Spécifications dynamiques par catégorie — 22/09/2026.
--
-- Isaac a signalé que le formulaire "Ajouter un produit" affiche exactement
-- les mêmes champs quelle que soit la catégorie choisie (un ordinateur et
-- une robe partagent le même formulaire), alors que chaque univers de
-- produit a ses propres informations utiles (RAM/stockage pour
-- l'informatique, poids net pour l'alimentation, matière pour la mode...).
--
-- Décision explicite avec Isaac avant de coder : une seule colonne jsonb
-- (clé -> valeur texte) plutôt qu'une table dédiée par catégorie — même
-- philosophie que le reste du projet, qui a délibérément gardé le modèle de
-- variantes simple plutôt que relationnel (voir 0010, "pas de stock par
-- combinaison exacte, pour rester simple"). Voir
-- src/lib/category-attributes.ts pour la liste des champs par catégorie
-- (4 grandes familles pour cette première passe, le reste des catégories
-- n'a pour l'instant aucun champ dédié) — ce fichier est la seule source de
-- vérité sur QUELS champs existent, aucune migration n'est nécessaire pour
-- en ajouter/modifier un.
--
-- Index GIN posé dès maintenant (même pattern que products.tags en 0011 et
-- products.highlights en 0031) : coûte peu, et évite une migration
-- supplémentaire le jour où ces champs serviront aussi de filtres
-- marketplace (chantier explicitement remis à plus tard par Isaac).
alter table products add column if not exists attributes jsonb not null default '{}'::jsonb;

create index if not exists products_attributes_idx on products using gin (attributes);
