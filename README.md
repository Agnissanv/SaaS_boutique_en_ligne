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
   `supabase/migrations/0001_init.sql` dans le SQL Editor du dashboard
   Supabase (ou `npx supabase db push` si la CLI est configurée).
3. **Configurer l'authentification par téléphone (OTP)** dans Supabase Auth
   (Authentication > Providers > Phone), avec un fournisseur SMS (ex. Twilio).
4. **Créer un compte marchand CinetPay** et renseigner `CINETPAY_API_KEY`,
   `CINETPAY_SITE_ID`, `CINETPAY_SECRET_KEY`.
5. Régénérer les types TypeScript depuis le schéma réel une fois le projet
   Supabase créé :
   ```bash
   npx supabase gen types typescript --project-id <PROJECT_ID> > src/lib/types/database.ts
   ```

## Structure du projet

```
src/app/
  (public)/[shopSlug]/          Page boutique publique + détail produit
  (vendor)/dashboard/           Espace vendeur (protégé par auth)
  (admin)/admin/                Back-office plateforme (rôle admin)
  api/cinetpay/webhook/         Webhook de notification de paiement
src/lib/supabase/               Clients Supabase (browser / server / middleware)
supabase/migrations/            Schéma SQL (tables + RLS)
public/manifest.json, sw.js     Support PWA
```

## État actuel

Squelette technique posé (routing, auth guard, schéma DB, PWA). Les pages
sont volontairement minimales : l'identité visuelle (couleurs, typographie,
mise en page définitive) n'est pas encore validée. Les formulaires de
création boutique/produit, le tunnel de commande, l'intégration CinetPay
complète et le tableau de bord vendeur restent à implémenter.
