# DataShare

Prototype de plateforme de transfert sécurisé de fichiers (MVP) — projet réalisé dans le cadre de la formation OpenClassrooms *« Pilotez le développement d'une solution informatique »*.

## Fonctionnalités

- Créer un compte / se connecter (authentification JWT)
- Téléverser un fichier (mot de passe optionnel, expiration réglable de 1 à 7 jours)
- Partager un lien de téléchargement unique
- Consulter l'historique de ses fichiers (« Mes fichiers ») et les supprimer
- Expiration et purge automatiques des fichiers échus (tâche planifiée quotidienne)

## Stack technique

| Composant | Techno | Dossier |
|---|---|---|
| Back-end (API REST) | NestJS 11 (TypeScript) | `backend/` |
| Front-end (SPA) | Angular 21 (TypeScript) | `frontend/` |
| Base de données | MongoDB 7 | — |
| Stockage des fichiers | Système de fichiers local | `storage/` (créé automatiquement) |

## Prérequis

- **Node.js 24 LTS** et **npm 11**
- **Docker Desktop** (pour MongoDB) — ou un accès à une instance MongoDB déjà existante (ex. Atlas)

## Démarrage rapide

```bash
# 1. Base de données
docker compose up -d

# 2. Back-end — API sur http://localhost:3000/api
cd backend
cp .env.example .env      # puis renseigner JWT_SECRET, ex : openssl rand -base64 48
npm install
npm run start:dev

# 3. Front-end — application sur http://localhost:4200
cd frontend
npm install
npm start
```

Ouvre ensuite **http://localhost:4200**. La documentation interactive de l'API (Swagger) est disponible sur **http://localhost:3000/api/docs**.

## Utilisation

1. **Créer un compte** (ou se connecter) sur l'écran d'accueil.
2. **Téléverser un fichier** : choisir le fichier, définir en option un mot de passe et une durée d'expiration (1 à 7 jours, 7 par défaut), puis valider. Un lien de téléchargement unique est généré.
3. **Partager le lien** obtenu (ex. `http://localhost:4200/d/<jeton>`) : la personne qui l'ouvre voit les métadonnées du fichier (nom, taille, expiration) et le télécharge — un mot de passe lui est demandé si le fichier en est protégé.
4. **Suivre ses fichiers** depuis « Mes fichiers » : historique avec filtre par statut (tous / actifs / expirés), accès rapide au lien, et suppression manuelle à tout moment.
5. **Expiration automatique** : passé le délai choisi à l'envoi, le fichier n'est plus accessible et disparaît du disque (une trace minimale reste visible dans l'onglet « Expiré » de l'historique, purgée après 30 jours).

## Variables d'environnement (`backend/.env`)

Un modèle est fourni dans `backend/.env.example`. Ne jamais commiter le fichier `.env` réel.

| Variable | Rôle | Valeur par défaut |
|---|---|---|
| `PORT` | Port d'écoute de l'API | `3000` |
| `FRONTEND_ORIGIN` | Origine autorisée par CORS | `http://localhost:4200` |
| `PUBLIC_BASE_URL` | Base des liens de téléchargement publics | `http://localhost:4200` |
| `MONGODB_URI` | Chaîne de connexion MongoDB | `mongodb://localhost:27017/datashare` |
| `JWT_SECRET` | Secret de signature des jetons — **à générer**, jamais commité | *(vide)* |
| `JWT_EXPIRES_IN` | Durée de validité du jeton | `24h` |
| `STORAGE_DIR` | Dossier de stockage des fichiers téléversés | `../storage` |
| `MAX_FILE_SIZE` | Taille maximale d'un fichier, en octets | `1073741824` (1 Gio) |
| `LOG_LEVEL` | Niveau de verbosité des logs structurés | `info` |

## Tests

```bash
# Back-end (depuis backend/)
npm test              # tests unitaires (Jest)
npm run test:cov      # + rapport de couverture (backend/coverage/)
npm run test:e2e      # tests d'intégration (Mongo doit être démarré)

# Front-end (depuis frontend/)
npm test               # tests unitaires (Vitest)
npm run test:cov       # + rapport de couverture (frontend/coverage/)
npm run e2e            # tests end-to-end (Cypress — backend + Mongo + `ng serve` doivent tourner)
```

## Structure du dépôt

```
backend/             API NestJS (modules Auth, Files, Users)
frontend/            Application Angular (SPA)
perf/                Script de test de charge (k6)
docker-compose.yml   Service MongoDB
TESTING.md           Plan de tests, critères d'acceptation, couverture
SECURITY.md          Scan de sécurité des dépendances et mesures en place
PERF.md              Test de performance, logs structurés, budget front
MAINTENANCE.md       Procédures de maintenance et de dépannage
```

## Documentation

- [`TESTING.md`](./TESTING.md) — stratégie de test, plan de tests, couverture de code
- [`SECURITY.md`](./SECURITY.md) — scan de sécurité des dépendances, mesures en place
- [`PERF.md`](./PERF.md) — test de charge, logs structurés, budget de performance front
- [`MAINTENANCE.md`](./MAINTENANCE.md) — démarrage/arrêt, sauvegarde, mise à jour des dépendances, dépannage

La **documentation technique complète** (architecture, choix technologiques justifiés, modèle de données, contrat d'API, sécurité, utilisation de l'IA dans le développement) est fournie séparément au format PDF, en tant que livrable du projet.

## Licence

Projet privé réalisé dans le cadre d'une formation — non destiné à la diffusion publique.
