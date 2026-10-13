# Audit visuel KEVA — 13/10/2026

Fait sur la version en local, en production, avec les vraies données : contrôles automatiques sur 18 pages publiques, puis revue écran par écran sur téléphone (375 px) et sur ordinateur (1280 px). Le même jour, toutes les corrections relevant du code ont été appliquées.

## Corrigé

### Mise en page
- **Bande blanche de 64 px sous le pied de page (téléphone).** Retirée : le pied de page réserve déjà lui-même la place de la barre du bas.
- **Pages de résultats** (recherche, catégorie, filtres) : les résultats commençaient environ 1 400 px plus bas quand on y arrivait par un lien. Le bandeau, les garanties et la bande de boutiques n'y sont plus affichés, et les résultats arrivent juste sous l'en-tête.
- **En-tête sur téléphone sur une seule ligne** : logo, recherche, bouton loupe. Il faisait environ 110 px de haut une fois qu'on défilait.
- **Bandeau d'accueil sur ordinateur** : le titre débordait sur les visuels (« Côte » posé sur les feuilles vertes). Un voile clair passe maintenant derrière le texte.
- **Page boutique** : la description est limitée à 3 lignes avec « Lire la suite », les 3 infos de confiance tiennent sur une ligne sur téléphone, et les cartes produit ne répètent plus le nom de la boutique. Les produits commencent à 873 px au lieu de 1 116.
- **Fiche produit** : la barre « Ajouter au panier » du bas n'apparaît que lorsque le vrai bouton n'est pas visible à l'écran.
- **Panier** : photo de chaque article, et un vrai état « panier vide » (icône, texte, bouton).
- **Barres de défilement** grises sous les bandes horizontales : masquées sur écran tactile, fines et discrètes à la souris.
- **Noms de boutiques** sur 2 lignes au lieu d'être coupés.
- **Bouton « Continuer avec Google »** en pleine largeur, comme les autres boutons.

### Bugs
- **La liste de suggestions s'ouvrait toute seule** par-dessus les résultats à l'arrivée sur une page de résultats.
- **Montants sans séparateur de milliers** (« 380000 FCFA ») à 72 endroits : une seule fonction de mise en forme, `fcfa()` dans `src/lib/utils/money.ts`, est maintenant utilisée partout.

### Lisibilité et accessibilité
- **Contrastes** : 408 textes gris trop pâles ont été remontés au minimum de lisibilité. Le gris à 50 % et 60 % passe à 70 %, le gris à 40 % (icônes, séparateurs) passe à 60 %. Les sous-titres sur fond beige-vert sont à 80 %. Un nouveau contrôle ne trouve plus aucun texte sous le seuil sur les pages vérifiées.
- **Zones de clic** : liens du pied de page à 40 px de haut, icône Facebook à 40 × 40 px, champs et boutons des formulaires de connexion et d'inscription à 44 px.
- **Libellés** : « Tout voir » et « Voir tout » sont unifiés en « Voir tout », à la même taille partout.
- **Étiquettes pour lecteurs d'écran** sur les 7 champs de recherche.
- **Titres d'onglet** propres pour Connexion, Inscription, Mon compte (connexion et inscription), Panier et Favoris. Une adresse introuvable affiche « Page introuvable ».
- **Exemples des champs partenaire** : « Ex : AWA225 » en écriture normale.

## Reste à faire (hors code, décision d'Isaac)
1. **Visuels du carrousel** : logos de marques connues (pomme Apple, JBL, virgule façon Nike). Il faut les remplacer par des visuels sans marques.
2. **Photos des vendeurs** avec du texte et des prix incrustés : à traiter par des conseils photo pour les vendeurs.
3. **Espaces connectés** (tableau de bord vendeur, admin, espace partenaire) : non audités, il faut se connecter. À faire à partir de captures d'Isaac.

## Vérifié sans défaut
Catégories, Tarifs, blog (liste et article), FAQ, contact, pages légales, page 404 : aucun débordement, aucun contraste insuffisant.
