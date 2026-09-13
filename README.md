# SaaS Boutique en ligne

Plateforme permettant aux petits vendeurs en Côte d'Ivoire de créer une
boutique en ligne, gérer leurs produits/commandes, et être payés en Mobile
Money. Voir `cahier_de_charge.md` pour le détail fonctionnel complet.

## Stack

- **Next.js** (App Router, TypeScript) — un seul codebase pour les pages
  boutique publiques, le dashboard vendeur et l'admin.
- **PWA** — installable sur mobile sans passer par un store (`public/manifest.json`, `public/sw.js`).
- **Supabase** — base de données Postgres, authentification (téléphone + OTP), stockage des images, Row Level Security.
- **CinetPay** — paiements Mobile Money (Wave, Orange Money, MTN, Moov).
- **Auth par email OTP (gratuit, par défaut)** pour l'instant. L'OTP téléphone (API Orange SMS CI prête dans `/api/auth/send-sms-hook`, ~7 FCFA/SMS) est reporté jusqu'à ce que le produit génère du revenu — voir `decisions-techniques.md`.
- **Vercel** — hébergement.

Détails et justification des choix : voir le document `decisions-techniques.md` dans le projet Claude.

## Démarrer en local

```bash
npm install
cp .env.example .env.local   # puis remplir les variables (voir ci-dessous)
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

## Configuration requise avant de pouvoir tester

1. **Créer un projet Supabase** (https://supabase.com) et récupérer :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (Project Settings > API — à garder secrète)
2. **Appliquer le schéma de base de données** : coller le contenu de
   `supabase/migrations/0001_init.sql`, PUIS `0002_profile_trigger.sql`, PUIS
   `0003_storage.sql`, PUIS `0004_orders_rpc.sql`, PUIS `0005_shop_stats.sql`
   dans le SQL Editor du dashboard Supabase, dans cet ordre (ou
   `npx supabase db push` si la CLI est configurée).
   - `0002` crée un trigger qui remplit automatiquement la table `profiles`
     à chaque inscription — sans lui, la connexion fonctionne mais aucune
     ligne `profiles` n'existe pour l'utilisateur.
   - `0003` crée le bucket Supabase Storage `shop-assets` (public, pour les
     logos/couvertures/photos produit) et ses policies RLS. Rien à faire côté
     dashboard Supabase : tout est créé par ce fichier SQL.
   - `0004` crée les fonctions `create_order` / `get_order_receipt` /
     `get_order_receipt_items`, utilisées par le tunnel de commande client
     (panier → commande → reçu) pour créer/lire une commande sans compte
     client, en toute sécurité (voir `decisions-techniques.md`).
   - `0005` ajoute `shops.view_count` et la fonction `increment_shop_view`,
     utilisée par le compteur de vues du tableau de bord vendeur.
   - `0006` ajoute `orders.delivery_lat` / `orders.delivery_lng` (position
     GPS optionnelle partagée par le client au checkout) et met à jour
     `create_order` / `get_order_receipt` en conséquence.
   - `0007` ajoute le back-office admin : fonction `is_admin()`, policies
     RLS `*_admin_*` (accès admin en lecture/écriture large sur boutiques,
     profils, commandes, paiements, abonnements, logs), `shops.admin_notes`
     et la fonction `start_free_subscription`.
   - `0008` **corrige une faille de sécurité** : `profiles.role` et
     `shops.status` étaient modifiables par n'importe quel vendeur sur sa
     propre ligne (RLS ne restreint que les lignes, pas les colonnes) —
     n'importe qui pouvait donc se passer `role = 'admin'` ou réactiver sa
     boutique suspendue via une simple requête `update` depuis le
     navigateur. Ajoute des triggers qui bloquent ces deux changements sauf
     pour un admin déjà authentifié. Déplace aussi `shops.admin_notes` vers
     une table séparée `shop_admin_notes` (admin-only), pour la même
     raison : cette colonne était lisible/modifiable par le vendeur lui-même.
     **À appliquer avant toute mise en production.**
3. **Authentification — SMTP Brevo déjà configuré.** L'OTP par téléphone
   (Orange/CinetPay SMS) est **reporté** tant que le produit ne génère pas de
   revenu (voir `decisions-techniques.md`) : tout SMS OTP coûte de l'argent,
   même Orange. En attendant, Supabase Auth envoie l'OTP par **email** :
   ```js
   await supabase.auth.signInWithOtp({ email })
   ```
   Le service email intégré de Supabase est plafonné à 2 emails/heure pour
   tout le projet — insuffisant même pour tester. Un SMTP externe **Brevo**
   est configuré dans Authentication > Settings > SMTP Settings (300
   emails/jour gratuits), avec le domaine `agnissanisaac.com` authentifié
   côté Brevo (SPF/DKIM/DMARC) pour l'expéditeur. **Point important** : ne
   jamais mettre une adresse `@gmail.com`/`@outlook.com`/etc. comme "Sender
   email" — les grands fournisseurs (Gmail en tête) rejettent désormais tout
   email envoyé "en leur nom" par un tiers non authentifié (erreur
   `550-5.7.26`). L'expéditeur doit toujours être une adresse d'un domaine
   authentifié dans Brevo.
   Le champ `phone` reste dans `profiles` (rempli plus tard dans le
   formulaire boutique, pour le contact WhatsApp client) mais n'est pas
   utilisé pour la connexion tant que l'OTP téléphone n'est pas réactivé.
   Le code Orange (`src/lib/sms/orange.ts`, `/api/auth/send-sms-hook`) reste
   dans le repo, prêt à être activé plus tard sans rien réécrire.
4. **Créer un compte marchand CinetPay** et renseigner `CINETPAY_API_KEY`,
   `CINETPAY_SITE_ID`, `CINETPAY_SECRET_KEY`.
5. Régénérer les types TypeScript depuis le schéma réel une fois le projet
   Supabase créé :
   ```bash
   npx supabase gen types typescript --project-id <PROJECT_ID> > src/lib/types/database.ts
   ```
6. **Connexion par mot de passe activée (13/09/2026)** — vérifier dans le
   dashboard Supabase (Authentication > Providers > Email) que "Email" est
   activé avec la connexion par mot de passe autorisée (c'est le réglage par
   défaut ; rien à changer normalement, mais à vérifier si la connexion par
   mot de passe échoue systématiquement). Aucune nouvelle migration requise :
   les mots de passe vivent dans `auth.users` (géré par Supabase), pas dans
   `public.profiles`.
7. **Blocage abonnement expiré** — aucune configuration Supabase requise, ni
   nouvelle migration : la logique est entièrement calculée côté application
   (`src/lib/subscription.ts`) à partir des colonnes déjà existantes.
8. **Vraie page d'inscription ajoutée (13/09/2026)** — `/inscription` (email +
   mot de passe + nom) remplace le lien magique comme point d'entrée pour
   créer un compte. Appliquer la migration `0009_signup_display_name.sql`
   (adapte le trigger `handle_new_user()` pour récupérer le nom saisi). Le
   lien magique (`/connexion`) reste disponible mais ne crée plus de compte
   implicitement (`shouldCreateUser: false`) — vérifier si besoin, dans le
   dashboard Supabase (Authentication > Providers > Email), si "Confirm
   email" est activé ou non : les deux cas sont gérés côté formulaire
   (connexion immédiate si désactivé, message "vérifie ton email" sinon).
9. **Sélection combinée de variantes corrigée (13/09/2026)** — appliquer la
   migration `0010_multi_variant_order_items.sql` (remplace
   `order_items.variant_id` par une table de jointure `order_item_variants`,
   pour choisir une variante par groupe — Taille ET Couleur — au lieu d'une
   seule au total). Sans base de commandes réelle à migrer, la colonne a été
   retirée directement plutôt que gardée en doublon.

## Structure du projet

```
src/app/
  page.tsx                       Marketplace publique (accueil) : catalogue tous vendeurs, recherche, catégories
  (public)/[shopSlug]/          Page boutique, détail produit, panier, tunnel de commande, reçu
  (vendor)/dashboard/           Espace vendeur (protégé par auth) : boutique, produits, commandes
  (admin)/admin/                Back-office plateforme (rôle admin) : vue d'ensemble, vendeurs, abonnements, transactions
  auth/callback/                Échange le code du lien magique contre une session
  api/cinetpay/webhook/         Webhook de notification de paiement
  api/auth/send-sms-hook/       Envoi des OTP téléphone via l'API Orange SMS
src/lib/sms/orange.ts           Client API Orange SMS Côte d'Ivoire
src/lib/supabase/               Clients Supabase (browser / server / middleware / storage)
src/lib/cart/                   Panier client (localStorage, un par boutique)
src/lib/categories.ts           Catégories boutique/produit partagées (une seule source de vérité)
supabase/migrations/            Schéma SQL (tables + RLS + fonctions RPC)
public/manifest.json, sw.js     Support PWA
```

## État actuel

Squelette technique posé (routing, auth guard, schéma DB, PWA). Les pages
sont volontairement minimales : l'identité visuelle (couleurs, typographie,
mise en page définitive) n'est pas encore validée.

Fonctionnel dès maintenant, une fois `0001` + `0002` + `0003` appliquées :
- **Portail de connexion unique** (`/connexion`) : saisie email → Supabase
  envoie un email de connexion → `/auth/callback` échange le code du lien
  contre une session puis redirige vers l'espace correspondant au **rôle**
  du compte (`/admin` pour un admin, `/dashboard` pour un vendeur) — un seul
  écran de connexion pour tout le monde, pas un portail admin séparé.
  Supabase envoie un **lien** (pas un code) même en appelant
  `signInWithOtp` — pas de champ "code" dans l'UI : le template email
  "Magic Link" du dashboard Supabase n'affiche pas `{{ .Token }}`, donc un
  tel champ n'aurait rien à valider (source de confusion testée et retirée
  le 13/09/2026). À réintroduire si ce template est personnalisé un jour —
  plus fiable sur mobile si le lien est ouvert dans une autre
  appli/navigateur que celui ayant fait la demande (limite connue du flux
  PKCE). Bouton "Déconnexion" dans le dashboard vendeur et le back-office
  admin (`src/app/auth/actions.ts`, `signOut` — révoque la session côté
  Supabase, pas juste le cookie local).
- **Création/édition boutique** (`/dashboard/boutique`) : nom, description
  (300 car. max), catégorie, logo et image de couverture ; génère
  automatiquement un slug unique (lien public `/<slug>`). Le vendeur est
  redirigé ici tant qu'il n'a pas encore de boutique.
- **Gestion produits** (`/dashboard/produits`) : liste (avec miniature),
  ajout, modification, activation/désactivation et suppression (douce, via
  `deleted_at`) ; prix, prix barré, stock, catégorie, jusqu'à 6 photos,
  variantes simples Taille/Couleur (texte séparé par des virgules, ex:
  "S, M, L"). Le stock détaillé par variante n'est pas géré :
  `products.stock` fait foi globalement pour l'instant. Les produits
  désactivés/supprimés n'apparaissent plus sur la boutique publique, qui
  affiche maintenant le logo, la couverture et les photos produit.
- **Upload d'images** : envoi direct du navigateur vers Supabase Storage
  (bucket public `shop-assets`), pas via le serveur Next.js — évite les
  limites de taille des Server Actions et des fonctions Vercel, important
  pour des photos prises au téléphone (max 5 Mo/image, imposé côté client).
  Sécurité assurée par les policies RLS de `0003_storage.sql` : chaque
  vendeur ne peut écrire que dans son propre dossier
  (`{user_id}/shop/...`, `{user_id}/products/...`).
- **Panier + tunnel de commande côté client** : sur la page produit, choix
  d'une variante (une seule à la fois — voir limitation ci-dessous) et
  quantité, "Ajouter au panier" (panier en localStorage, par boutique, pas
  de compte client). Page `/<slug>/panier` : ajustement des quantités puis
  formulaire (nom, téléphone, adresse — obligatoire —, mode de paiement).
  Bouton "Partager ma position" (géolocalisation navigateur, optionnel) :
  transmet au vendeur un lien Google Maps exact en plus de l'adresse écrite
  — sans clé API ni compte de facturation Google, juste
  `https://www.google.com/maps?q=<lat>,<lng>` (voir `decisions-techniques.md`).
  Paiement à la livraison fonctionnel dès maintenant ; Mobile Money visible
  mais désactivé tant que CinetPay n'est pas branché sur le checkout (voir
  plus bas). Validation → commande créée via la fonction `create_order`
  (stock vérifié et décrémenté atomiquement, pas de survente possible même
  en cas de commandes simultanées) → page de confirmation/reçu
  `/<slug>/commande/<id>`.
  - **Limitation connue** : un produit avec DEUX groupes de variantes (ex:
    Taille ET Couleur) ne permet de choisir qu'UNE option au total pour
    l'instant (le schéma `order_items.variant_id` ne référence qu'une seule
    variante à la fois). Un vrai système de combinaisons (Taille + Couleur
    ensemble) est listé "Priorité 2" dans le cahier des charges — pas
    nécessaire pour le MVP.
- **Gestion des commandes vendeur** (`/dashboard/commandes`) : liste,
  détail (articles, montant, adresse + lien Google Maps si le client a
  partagé sa position), changement de statut (En attente / Payée / En
  préparation / Livrée / Annulée), bouton contact WhatsApp direct vers le
  client (`wa.me/<numéro>`) et bouton d'appel.
- **Tableau de bord vendeur** (`/dashboard`, page "Aperçu") : nombre de vues
  de la boutique (compteur simple incrémenté à chaque affichage de la page
  boutique publique, sans déduplication par visiteur), nombre total de
  commandes, chiffre d'affaires du jour / de la semaine / du mois (somme des
  commandes non annulées), 5 commandes les plus récentes, alertes stock bas
  (produits actifs à 5 unités ou moins — seuil fixe pour l'instant, pas
  encore configurable par boutique).
- **Marketplace publique** (`/`, page d'accueil) : catalogue de tous les
  produits actifs de toutes les boutiques actives de la plateforme, avec
  recherche par titre et filtre par catégorie, pagination simple (24
  articles/page). Chaque carte produit renvoie vers la fiche produit du
  vendeur (`/<slug>/<produit>`) — panier et tunnel de commande inchangés.
  Un lien discret "Vendre sur la plateforme" renvoie vers `/connexion`.
  **Remarque de priorisation** : le cahier des charges classe la
  "marketplace globale (recherche multi-boutiques)" en Priorité 3 (roadmap
  long terme, après le MVP et la Priorité 2) ; construite ici par
  anticipation à la demande explicite d'Isaac le 13/09/2026, avant certains
  items encore ouverts de la Priorité 1 (CinetPay notamment) — voir
  `decisions-techniques.md`.

- **Back-office admin** (`/admin`, réservé au rôle `admin` sur `profiles`) :
  vue d'ensemble (nombre de boutiques actives/suspendues, CA plateforme,
  abonnements actifs), gestion des vendeurs (recherche par nom/lien de
  boutique, activation/suspension, note admin libre par boutique), gestion
  des abonnements (assignation manuelle de plan Gratuit/Essentiel/Pro en
  attendant que CinetPay soit branché), journal des transactions (actions
  admin : suspension, changement de plan). Chaque boutique démarre
  désormais avec un abonnement "Gratuit limité" automatique à sa création.
- **Connexion vendeur/admin par mot de passe** (`/connexion`), en plus du
  lien magique gardé en secours : `signInWithPassword` par défaut, bouton
  pour basculer vers le lien magique, "mot de passe oublié / pas encore
  défini ?" (`resetPasswordForEmail`) menant à `/connexion/nouveau-mot-de-passe`.
  Aucune migration nécessaire — mots de passe gérés par `auth.users`
  (Supabase Auth).
- **Blocage progressif d'abonnement expiré** (§3.1.A.7, `src/lib/subscription.ts`) :
  l'état réel (actif / période de grâce de 7 jours / expiré) est calculé à la
  volée à partir de `subscriptions.expires_at`, pas lu depuis la colonne
  `status` (jamais mise à jour sans job planifié — volontairement absent de
  ce projet pour l'instant). Le vendeur voit une bannière d'avertissement dès
  la période de grâce puis, une fois réellement expiré, ne peut plus ajouter
  de nouveau produit (`/dashboard/produits/nouveau`) — le reste (gérer les
  produits/commandes existants, boutique publique) continue de fonctionner
  normalement. Le back-office admin (`/admin/abonnements`, `/admin`) affiche
  désormais ce même statut calculé plutôt que la colonne figée.

Restent à implémenter (Priorité 1 du cahier des charges, toujours en
attente) : intégration CinetPay complète pour le paiement Mobile Money au
checkout et à l'abonnement (aujourd'hui : paiement à la livraison
uniquement, abonnements assignés/renouvelés manuellement par l'admin) et le
réversement des gains aux vendeurs.
