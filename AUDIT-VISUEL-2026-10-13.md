# Audit visuel KEVA — 13/10/2026 (partiel, à compléter)

Fait sur la version en local, en production, avec les vraies données. Les contrôles automatiques couvrent 18 pages publiques en largeur téléphone (375 px). La revue écran par écran n'est faite que pour l'accueil, sur téléphone.

## Corrections à faire

### Priorité haute
1. **Bande blanche sous le pied de page (téléphone).** Sur les pages qui ont la barre du bas, la cale de 64 px qui empêche la barre de masquer le contenu est placée après le pied de page vert foncé. Elle fait apparaître une bande blanche en fin de page. Il faut la placer avant le pied de page, ou lui donner la même couleur que lui.
2. **Visuels du carrousel de l'accueil.** On y voit des marques connues (pomme Apple, JBL, virgule façon Nike) que les vendeurs ne vendent pas forcément. C'est un risque de confiance et un risque juridique : prévoir des visuels sans logos de marques.

### Priorité moyenne
3. **Contrastes trop faibles (sous le minimum d'accessibilité) :**
   - libellés inactifs de la barre du bas : gris à 60 % en 11 px, contraste 3,5 ;
   - dates et temps de lecture du blog : 2,7 ;
   - « / 30 jours » et la note sous les formules sur la page Tarifs : 2,7 à 3,4 ;
   - la mention sous le formulaire de contact : 2,7 ;
   - le « ou » entre les boutons de connexion : 2,2 ;
   - les sous-titres de la FAQ, du blog et du contact : 4,4, juste sous le seuil de 4,5.
4. **Zones de clic trop petites sur téléphone :**
   - liens du pied de page : 16 px de haut ;
   - icône Facebook : 16 × 16 px ;
   - boutons des formulaires de connexion et d'inscription : 36 px (44 px recommandés) ;
   - « Oublié / pas encore défini ? » : 16 px.
5. **Barres de défilement visibles sous les bandes horizontales** (catégories, boutiques, rangées de produits) sur ordinateur et sur Android. Il faut les masquer, ou utiliser une barre fine et discrète.
6. **Libellés incohérents :** « Tout voir » (catégories, blog, promotions, en petit) et « Voir tout » (rangées de produits, plus grand). Il faut choisir un seul libellé et une seule taille.

### Priorité basse
7. **Deux balises de titre principal (h1) identiques sur l'accueil.** Il n'en faut qu'une.
8. **Barres de recherche sans étiquette** pour les lecteurs d'écran (en-tête et hero). Ajouter `aria-label="Rechercher"`.
9. **Titres d'onglet génériques :** Connexion, Inscription, Panier et Favoris affichent « KEVA — La marketplace ivoirienne… ». Une adresse introuvable à deux niveaux affiche « Produit introuvable ».
10. **Noms de boutiques coupés** dans les cartes (« MAMFO SOL… », « Epiphane … ») : prévoir 2 lignes.
11. **En-tête mobile haut une fois qu'on a défilé** (environ 110 px : logo, puis recherche). On peut le réduire à une seule ligne quand on défile.
12. **Images de vendeurs avec du texte et des prix incrustés** (ex. « Diffuseur de parfum 2 000 F ») : à traiter par des conseils photo pour les vendeurs.

## Ce qui va bien
- Aucune page ne déborde à l'horizontale, sur 18 pages.
- Aucune image sans description, aucun bouton sans nom.
- En-tête qui devient blanc au défilement, barre du bas qui se cache, fiche produit avec une seule barre d'achat : tout fonctionne.
- Hiérarchie claire sur l'accueil : hero, bandeau de confiance, catégories, boutiques, rangées de produits, encart vendeur, blog.

## Reste à faire
- Revue écran par écran sur téléphone : recherche, boutique, fiche produit, panier avec un article, catégories, tarifs, blog et article, FAQ, contact, pages légales, connexion et inscription, page 404, invitation partenaire.
- La même revue sur ordinateur.
- Les espaces connectés (tableau de bord vendeur, admin, espace partenaire) : ils demandent des captures fournies par Isaac.
