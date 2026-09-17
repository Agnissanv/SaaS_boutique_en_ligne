# Relais IP fixe pour CinetPay — déploiement (coût : 0 FCFA/mois)

## Le problème, en une phrase

CinetPay refuse les appels de KEVA avec `NOT_ALLOWED — This Ip is not whitelisted`, parce que Vercel n'a pas d'IP sortante fixe (une IP fixe chez Vercel est une fonctionnalité payante réservée aux plans Pro/Enterprise). Même si le support CinetPay whitelistait une IP aujourd'hui, l'appel suivant partirait d'une IP Vercel différente et échouerait à nouveau.

## La solution : une VM gratuite à vie, avec une vraie IP fixe

Une petite machine virtuelle sur l'offre "Always Free" de Google Cloud ou d'Oracle Cloud (0 FCFA/mois, pour toujours, pas un essai limité dans le temps) sert de relais : KEVA (Vercel) appelle cette VM au lieu d'appeler CinetPay directement, et c'est la VM (dont l'IP est fixe) qui parle à CinetPay. C'est CETTE IP qu'il faut faire whitelister par CinetPay.

**Avant de commencer**, ça vaut le coup de vérifier une chose gratuite en parallèle : dans `panel.cinetpay.net`, section Sécurité/API, y a-t-il un champ où tu peux toi-même ajouter une IP à une liste blanche ? Si oui, c'est là qu'il faudra coller l'IP de la VM une fois créée — pas la peine d'attendre une réponse du support pour ça.

## Étape 1 — Créer la VM gratuite

Deux options, au choix (les deux sont à 0 FCFA/mois pour toujours) :

- **Google Cloud, instance `e2-micro`** (recommandé — inscription plus simple) : région `us-west1`, `us-central1` ou `us-east1` (seules régions couvertes par l'offre "Always Free"), image Ubuntu. Carte bancaire demandée à l'inscription pour vérification d'identité, jamais débitée tant que tu restes dans les limites gratuites.
- **Oracle Cloud, offre "Always Free"** : plus généreuse en ressources, mais l'inscription est parfois capricieuse ("capacité indisponible" au moment de créer la VM — à retenter plus tard si ça arrive).

Une fois la VM créée, note son **IP publique fixe**.

## Étape 2 — Pointer un sous-domaine dessus

Dans la zone DNS de `agnissanisaac.com` (déjà utilisée pour Brevo), ajoute un enregistrement **A** :

```
cinetpay-relay.agnissanisaac.com  →  <IP publique de la VM>
```

## Étape 3 — Installer Node.js et Caddy sur la VM

En SSH sur la VM (Ubuntu) :

```bash
sudo apt update
sudo apt install -y nodejs npm caddy
```

(Si `caddy` n'est pas disponible directement via `apt` sur ton image, la doc officielle caddyserver.com/docs/install donne la commande à jour pour Ubuntu.)

## Étape 4 — Déployer le relais

Copie les deux fichiers `relay.js` et `Caddyfile` (fournis à côté de ce guide) sur la VM, par exemple dans `/opt/cinetpay-relay/`.

Édite le `Caddyfile` si besoin (le sous-domaine doit correspondre à celui pointé à l'étape 2), puis :

```bash
sudo cp /opt/cinetpay-relay/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Génère un secret long et aléatoire une fois (à garder précieusement, il servira aussi côté Vercel) :

```bash
openssl rand -hex 32
```

Lance le relais en permanence avec `pm2` (redémarre tout seul si la VM reboote) :

```bash
sudo npm install -g pm2
RELAY_SECRET="<le secret généré ci-dessus>" pm2 start /opt/cinetpay-relay/relay.js --name cinetpay-relay
pm2 save
pm2 startup   # affiche une commande à copier-coller pour démarrer pm2 au boot de la VM
```

## Étape 5 — Pare-feu

Sur la VM (ou dans les règles réseau de Google/Oracle Cloud), autoriser seulement les ports **80** et **443** en entrée (Caddy en a besoin pour obtenir le certificat HTTPS). Le port 8080 (le relais lui-même) n'a jamais besoin d'être ouvert vers l'extérieur : il n'écoute que sur `127.0.0.1`.

## Étape 6 — Faire whitelister l'IP de la VM par CinetPay

Soit toi-même dans `panel.cinetpay.net` si un tel champ existe, soit en donnant cette IP précise au support CinetPay (référence à l'erreur déjà rencontrée : `NOT_ALLOWED — This Ip is not withlisted`).

## Étape 7 — Variables d'environnement Vercel

Dans les Settings du projet KEVA sur Vercel, ajouter :

```
CINETPAY_RELAY_URL=https://cinetpay-relay.agnissanisaac.com
CINETPAY_RELAY_SECRET=<le même secret généré à l'étape 4>
```

Le code (`src/lib/cinetpay.ts`) est déjà prêt à les utiliser — rien d'autre à changer côté application. Sans ces deux variables, KEVA continue d'appeler CinetPay directement comme avant (donc rien ne casse tant que le relais n'est pas prêt).

## Étape 8 — Tester

Redéployer (ou juste attendre le prochain déploiement Vercel pour que les nouvelles variables soient prises en compte), puis retenter le paiement de test sur `/dashboard/abonnement`. Si ça échoue encore avec `NOT_ALLOWED`, c'est que l'IP de la VM elle-même n'est pas encore whitelistée côté CinetPay (étape 6) — pas un problème de relais.

## Ce que ça coûte vraiment

0 FCFA/mois tant que la VM reste dans les limites de l'offre "Always Free" (un usage aussi léger qu'un relais de paiement y reste confortablement). Le seul "coût" est le temps de mise en place (30-45 minutes la première fois) et la responsabilité de garder cette petite VM à jour (`sudo apt update && sudo apt upgrade` de temps en temps).
