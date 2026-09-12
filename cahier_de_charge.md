**CAHIER DES CHARGES COMPLET**  
**Projet : Plateforme de création de boutiques en ligne pour petits vendeurs – Côte d’Ivoire**

**Version :** 1.0  
**Date :** 12 septembre 2026  
**Statut :** Document de référence technique et fonctionnel  
**Public cible :** Tous les développeurs, product owners et parties prenantes du projet

---

### 1. Présentation générale du projet

#### 1.1 Contexte
En Côte d’Ivoire, une très grande partie du commerce de détail (vêtements, cosmétiques, accessoires, électronique, produits locaux, etc.) se fait encore via WhatsApp, Instagram et Facebook. Les vendeurs (surtout les femmes et les jeunes) n’ont pas de véritable boutique en ligne propre. Ils envoient des photos une par une, répondent manuellement aux demandes de prix et de disponibilité, et gèrent les paiements de façon artisanale (Mobile Money manuel + captures d’écran).

Ce mode de fonctionnement génère :
- Perte de temps importante
- Erreurs de stock
- Difficultés de suivi des commandes
- Image peu professionnelle
- Perte de clients potentiels

#### 1.2 Vision du produit
Créer une plateforme simple, 100 % adaptée au contexte ivoirien, qui permet à n’importe quel vendeur (même non technophile) de créer sa propre boutique en ligne en moins de 5 minutes, d’avoir un lien partageable propre, de recevoir des commandes et d’être payé via Mobile Money de façon fluide.

Le produit doit être :
- Extrêmement simple d’utilisation
- Optimisé pour le mobile
- Intégré nativement avec les moyens de paiement locaux (Wave, Orange Money, MTN Money, Moov Money)
- Orienté WhatsApp (canal principal de communication)
- Abordable (abonnement mensuel bas)

#### 1.3 Objectifs business
- Atteindre un volume important de vendeurs grâce à un prix bas et une simplicité extrême
- Générer des revenus récurrents via abonnements + options premium
- Devenir la solution de référence pour les micro et petits vendeurs en Côte d’Ivoire
- Permettre une délégation opérationnelle (gestion des vendeurs, support, acquisition) à une personne non technique

#### 1.4 Positionnement concurrentiel
- Moins cher et plus simple que Shopify, WooCommerce, ou les solutions internationales
- Plus professionnel et structuré que la simple vente WhatsApp/Instagram
- Plus adapté localement que Jumia (pas de commission élevée, pas de logistique imposée)
- Différenciation principale : rapidité de création de boutique + intégration Mobile Money + expérience WhatsApp native

---

### 2. Utilisateurs cibles

#### 2.1 Personas principaux

**Persona 1 – La vendeuse WhatsApp (cœur de cible)**
- Femme, 22-40 ans
- Vend des vêtements, cosmétiques, accessoires, produits locaux
- Utilise principalement WhatsApp et Instagram
- Niveau technique faible à moyen
- Besoin : avoir un catalogue propre, un lien à envoyer, recevoir des commandes sans stress

**Persona 2 – Le jeune revendeur**
- Homme ou femme, 18-30 ans
- Vend téléphones, accessoires, articles importés
- Assez à l’aise avec le digital
- Besoin : rapidité, suivi des stocks, image pro

**Persona 3 – Le client final**
- Habitant d’Abidjan et grandes villes
- Achète déjà via WhatsApp
- Paie principalement avec Wave / Orange Money
- Veut une expérience simple, rapide, sans friction

#### 2.2 Utilisateurs secondaires
- Administrateur de la plateforme
- Équipe support / community manager
- Éventuels livreurs partenaires (phase 2)

---

### 3. Périmètre fonctionnel

#### 3.1 Fonctionnalités MVP (Priorité 1 – Lancement)

**A. Côté Vendeur**

1. **Inscription / Connexion**
   - Inscription par numéro de téléphone + OTP SMS
   - Connexion par OTP (pas de mot de passe obligatoire au début)
   - Possibilité d’ajouter un nom d’affichage et une photo de profil

2. **Création de boutique**
   - Nom de la boutique
   - Photo de couverture
   - Logo / photo de profil boutique
   - Description courte (max 300 caractères)
   - Catégorie principale (Mode, Beauté, Électronique, Maison, Alimentation, Autre)
   - Génération automatique d’un lien unique : `domaine.ci/boutique/nom-boutique` ou `domaine.ci/u/identifiant`

3. **Gestion des produits**
   - Ajout de produit :
     - Titre
     - Description
     - Prix (FCFA)
     - Prix barré (optionnel)
     - Photos (minimum 1, maximum 6)
     - Stock (quantité)
     - Variantes simples (Taille, Couleur) – version basique
     - Catégorie / Tags
   - Modification / Suppression de produit
   - Activation / Désactivation d’un produit
   - Gestion du stock (décrément automatique à la commande)

4. **Tableau de bord vendeur**
   - Nombre de vues de la boutique
   - Nombre de commandes
   - Chiffre d’affaires du jour / de la semaine / du mois
   - Liste des commandes récentes
   - Alertes stock bas

5. **Gestion des commandes**
   - Liste des commandes (En attente, Payée, En préparation, Livrée, Annulée)
   - Détail d’une commande
   - Changement de statut
   - Coordonnées du client
   - Possibilité de contacter le client via WhatsApp en un clic

6. **Paiements**
   - Intégration Mobile Money (Wave, Orange Money, MTN, Moov) via agrégateur (CinetPay, PayDunya ou équivalent)
   - Option « Paiement à la livraison » (Cash on Delivery)
   - Confirmation automatique du paiement
   - Historique des paiements reçus

7. **Abonnement**
   - Formules d’abonnement (Gratuit limité / Essentiel / Pro)
   - Paiement de l’abonnement via Mobile Money
   - Blocage progressif des fonctionnalités si abonnement expiré (avec période de grâce)

**B. Côté Client (visiteur de la boutique)**

1. Page boutique publique responsive (mobile first)
2. Catalogue des produits avec filtres simples
3. Page détail produit
4. Panier
5. Tunnel de commande (coordonnées + mode de livraison + paiement)
6. Confirmation de commande + reçu

**C. Côté Administration**

1. Dashboard global (nombre de boutiques, CA plateforme, abonnements actifs)
2. Gestion des vendeurs (activation, suspension, recherche)
3. Gestion des abonnements
4. Logs des transactions
5. Support basique (tickets ou notes)

#### 3.2 Fonctionnalités Priorité 2 (Post-MVP – 1 à 3 mois après lancement)

- Variantes de produits avancées
- Codes promo / réductions
- Boost de boutique (mise en avant payante)
- Statistiques avancées (produits les plus vus, taux de conversion)
- Notifications push
- Multi-utilisateurs par boutique (collaborateurs)
- Export des commandes (CSV)
- Intégration WhatsApp Business API (messages automatiques)
- Système de notation / avis clients
- Mode hors-ligne basique pour le vendeur

#### 3.3 Fonctionnalités Priorité 3 (Roadmap longue)

- Livraison intégrée avec partenaires
- Marketplace globale (recherche multi-boutiques)
- Programme d’affiliation
- Application vendeur native plus poussée
- Version internationale (diaspora)

---

### 4. Exigences non fonctionnelles

#### 4.1 Performance
- Temps de chargement page boutique < 2,5 secondes sur 4G moyenne
- Support d’au moins 5 000 boutiques actives la première année
- Gestion de pics de trafic (événements, promotions)

#### 4.2 Disponibilité
- Objectif 99,5 % de disponibilité
- Sauvegardes quotidiennes automatiques
- Plan de reprise d’activité

#### 4.3 Sécurité
- Authentification par OTP
- Protection contre les attaques courantes (XSS, CSRF, injections SQL)
- Chiffrement des données sensibles
- Conformité minimale aux bonnes pratiques de protection des données
- Logs d’audit sur les actions critiques (paiements, modifications d’abonnement)

#### 4.4 Compatibilité
- Mobile first (Android prioritaire, puis iOS)
- Navigateurs modernes (Chrome, Safari, Firefox, Edge)
- Support des écrans de 360px à 1920px+

#### 4.5 Localisation
- Langue principale : Français
- Devise : FCFA (XOF)
- Formats de date et d’heure ivoiriens
- Numéros de téléphone au format +225

---

### 5. Architecture technique recommandée

#### 5.1 Stack proposé (modifiable selon l’équipe)

**Frontend**
- Application Vendeur + Admin : Flutter (ou React Native)
- Pages boutiques publiques + Landing : Next.js (React)
- Design system cohérent (Mobile + Web)

**Backend**
- API : NestJS (Node.js) ou Laravel (PHP)
- Base de données : PostgreSQL
- Cache : Redis
- File storage : AWS S3 ou équivalent (Cloudinary / local + CDN)
- File d’attente : BullMQ ou équivalent (pour les notifications et traitements asynchrones)

**Infrastructures**
- Hébergement : DigitalOcean / Render / AWS / Scaleway
- CI/CD : GitHub Actions
- Monitoring : Sentry + logs centralisés
- CDN : Cloudflare

**Intégrations obligatoires**
- Agrégateur de paiement Mobile Money (CinetPay ou PayDunya recommandé)
- Service SMS OTP (ex : Twilio, ou fournisseur local)
- WhatsApp (dans un premier temps liens deep link, puis Business API)

#### 5.2 Architecture globale
- Architecture orientée API (REST ou GraphQL)
- Séparation claire des domaines : Auth, Boutiques, Produits, Commandes, Paiements, Abonnements
- Multi-tenancy (chaque boutique est isolée logiquement)

---

### 6. Modèle de données (haut niveau)

**Entités principales :**
- User (vendeur / admin)
- Shop (boutique)
- Product
- ProductVariant
- Order
- OrderItem
- Payment
- Subscription
- SubscriptionPlan
- TransactionLog
- Notification

Relations clés à respecter strictement (intégrité référentielle, soft deletes sur les éléments critiques).

---

### 7. Parcours utilisateurs prioritaires (User Flows)

1. Inscription vendeur → Création boutique → Ajout premier produit → Partage du lien
2. Client arrive via lien → Parcourt → Ajoute au panier → Paie → Confirmation
3. Vendeur reçoit notification → Change statut commande → Contacte client
4. Vendeur paie son abonnement → Accès maintenu

Tous les parcours doivent être testés sur mobile réel (Android low-end inclus).

---

### 8. Design & Expérience utilisateur

- Design system clair, aéré, couleurs chaudes et professionnelles
- Très peu de texte, beaucoup de feedbacks visuels
- Onboarding guidé pour la création de boutique (step-by-step)
- Messages d’erreur en français simple et bienveillant
- Mode sombre optionnel (phase 2)

---

### 9. Contraintes et hypothèses

- Le projet démarre en Côte d’Ivoire uniquement
- La majorité du trafic sera mobile
- La connexion internet peut être instable → prévoir des états de chargement et retries
- Les vendeurs ont un niveau technique variable → simplicité extrême obligatoire
- Le support sera géré manuellement au début (WhatsApp)

---

### 10. Roadmap de développement proposée

**Phase 0 – Préparation (1 semaine)**  
Finalisation cahier des charges, choix stack définitif, setup projet, design system de base

**Phase 1 – MVP (6 à 10 semaines)**  
Toutes les fonctionnalités Priorité 1

**Phase 2 – Stabilisation + Acquisition (4 semaines)**  
Corrections, performances, onboarding amélioré, outils admin

**Phase 3 – Features Priorité 2**

---

### 11. Critères d’acceptation globaux

Une fonctionnalité est considérée comme terminée uniquement si :
- Elle répond exactement au besoin décrit
- Elle est testée sur mobile réel
- Les cas d’erreur sont gérés
- Elle est documentée (au minimum dans le code + README)
- Elle respecte le design system

---

### 12. Livrables attendus

- Code source versionné (Git)
- Documentation technique (architecture, API, déploiement)
- Documentation utilisateur (guide vendeur simple)
- Environnements : Développement / Staging / Production
- Scripts de déploiement
- Jeux de données de test

---

**Fin du cahier des charges – Version 1.0**