# MAINTENANCE.md — Procédures de maintenance et de correction

> Document de référence pour exploiter, sauvegarder et faire évoluer DataShare après la mise en production du prototype.

## 1. Vue d'ensemble des services

| Service | Techno | Port | Démarrage |
|---|---|---|---|
| `mongo` | MongoDB 7 (Docker) | 27017 | `docker compose up -d` |
| `backend` | NestJS 11 (Node.js) | 3000 (préfixe `/api`) | `npm run start` (`backend/`) |
| `frontend` | Angular 21 (dev server) | 4200 | `npm run start` (`frontend/`) |
| Stockage fichiers | Système de fichiers local | — | dossier `storage/` à la racine (`STORAGE_DIR`), **hors** conteneur Docker |

En développement, les trois services tournent en parallèle sur le poste ; `frontend` proxy `/api` vers `backend`, qui lit/écrit dans `mongo` et dans `storage/`.

## 2. Démarrage / arrêt

```bash
# Base de données
docker compose up -d          # démarrer Mongo
docker compose down           # arrêter Mongo (les données persistent dans le volume mongo-data)

# Back-end
cd backend
npm run start                 # production-like (pas de watch)
npm run start:dev             # avec rechargement à chaud

# Front-end
cd frontend
npm run start                 # ng serve, http://localhost:4200
```

**Ordre recommandé au démarrage** : `mongo` → `backend` → `frontend`. Le back-end échoue silencieusement (routes API en erreur `ECONNREFUSED` côté front) si Mongo n'est pas encore disponible — vérifier `docker ps` en cas de doute.

## 3. Variables d'environnement (`backend/.env`)

| Variable | Rôle | Exemple |
|---|---|---|
| `PORT` | Port d'écoute de l'API | `3000` |
| `FRONTEND_ORIGIN` | Origine autorisée par CORS | `http://localhost:4200` |
| `PUBLIC_BASE_URL` | Base utilisée pour composer les liens de téléchargement publics | `http://localhost:4200` |
| `MONGODB_URI` | Chaîne de connexion Mongo | `mongodb://localhost:27017/datashare` |
| `JWT_SECRET` | Secret de signature des tokens (**à générer**, jamais commité) | — |
| `JWT_EXPIRES_IN` | Durée de validité du token | `24h` |
| `STORAGE_DIR` | Dossier de stockage des fichiers téléversés | `../storage` |
| `MAX_FILE_SIZE` | Taille maximale d'un fichier, en octets | `1073741824` (1 Gio) |

`backend/.env.example` sert de modèle. **Ne jamais commiter `.env`** (déjà exclu par `.gitignore`).

## 4. Sauvegarde et restauration

### Base de données

```bash
# Sauvegarde
docker exec datashare-mongo mongodump --db datashare --archive=/tmp/datashare.dump
docker cp datashare-mongo:/tmp/datashare.dump ./backups/datashare-$(date +%Y%m%d).dump

# Restauration
docker cp ./backups/datashare-20260101.dump datashare-mongo:/tmp/restore.dump
docker exec datashare-mongo mongorestore --archive=/tmp/restore.dump --drop
```

### Fichiers stockés

Le dossier `storage/` (chemin défini par `STORAGE_DIR`) contient les fichiers téléversés, nommés par UUID. Une copie régulière du dossier (`robocopy`, `rsync` ou simple archive datée) suffit pour un prototype ; à industrialiser via un stockage objet (S3) prévu par `StorageService` avant un usage en production réelle.

**Cohérence** : la base (métadonnées) et le disque (contenu) doivent être sauvegardés **ensemble** et au même instant — un fichier orphelin en base sans contenu disque provoquera un 410 au téléchargement (comportement dégradé mais sans crash).

## 5. Mise à jour des dépendances

- **Règle impérative** : ne jamais réinstaller `@nestjs/jwt`, `@nestjs/config`, `@nestjs/mongoose`, `@nestjs/passport`, `@nestjs/schedule` ou `@nestjs/swagger` **sans épingler une version compatible NestJS 11** (`npm install @nestjs/xxx@^11` ou la version exacte documentée dans `package.json`). Les versions 12 de ces paquets sont publiées en ESM pur et cassent Jest (mode CJS) — cause déjà rencontrée pendant le développement.
- Avant toute mise à jour de dépendance : `npm outdated`, puis mise à jour **une famille à la fois**, puis `npm run lint && npm test && npm run build` avant de commiter.
- `npm audit` : voir `SECURITY.md` pour la procédure de traitement des vulnérabilités.

## 6. Supervision de la tâche planifiée (expiration automatique, US10)

- La tâche `FilesCleanupService` s'exécute chaque jour à **03:00** (`CronExpression.EVERY_DAY_AT_3AM`) : elle transforme les fichiers échus en tombstones puis purge les tombstones de plus de 30 jours.
- **Vérifier qu'elle tourne** : au démarrage du back-end, aucun log n'apparaît (normal, elle est seulement planifiée) ; le lendemain, un log `Nettoyage : X fichier(s) expiré(s), Y tombstone(s) purgé(s).` apparaît **si** au moins une action a eu lieu (silence sinon).
- **Test manuel accéléré** : voir `docs/etape-4/guide-us10-expiration.md` (section « Test manuel ») pour antidater un fichier et basculer temporairement le CRON sur `EVERY_30_SECONDS`.
- **Si la tâche ne s'exécute jamais** : vérifier que `ScheduleModule.forRoot()` est bien importé dans `app.module.ts` et que le processus back-end reste démarré en continu (un redémarrage quotidien via un outil externe, ex. PM2 ou un service systemd, est recommandé en production réelle).

## 7. Procédure de correction d'un bug

1. Reproduire le bug (test manuel ou, si possible, écrire d'abord un test qui échoue).
2. Créer une branche dédiée si on n'est pas déjà sur une branche de travail.
3. Corriger, puis vérifier dans l'ordre : `npm run lint`, `npm test` (ou `npx jest <fichier>` pour cibler), `npm run build`.
4. Commit avec un message [Conventional Commits](https://www.conventionalcommits.org/) (`fix(scope): …`), test associé dans un commit `test(scope): …` séparé si pertinent.
5. Mettre à jour `TESTING.md` si le correctif ajoute un cas de test durable.
6. `git push`.

## 8. Dépannage courant

| Symptôme | Cause probable | Solution |
|---|---|---|
| `npm install` échoue en `ERESOLVE` sur un paquet `@nestjs/*` | Version incompatible avec NestJS 11 | Réinstaller avec la version majeure épinglée (`@^11`) — voir §5 |
| Jest : `Must use import to load ES Module` | Un paquet `@nestjs/*` a été mis à jour en version 12 (ESM) | Revenir à la version Nest-11 compatible |
| Front : `[vite] http proxy error: /api/... ECONNREFUSED` | Le back-end n'est pas démarré, ou tourne en mode watch et redémarre au moment de la requête | Démarrer/relancer `npm run start` (back-end) sans mode watch pendant les tests manuels |
| `git commit` : `pathspec '...' did not match` (PowerShell) | Guillemets doubles à l'intérieur du message de commit mal échappés en PowerShell | Utiliser des guillemets simples autour du message, ou reformuler sans guillemets internes |
| `npm test` en boucle infinie qui semble « figé » | Mode watch (`ng test` / `jest --watch`) actif par défaut | Utiliser `npm test` (configuré en mode unique) plutôt que `test:watch` |
| Erreur husky `cannot spawn .husky/_/commit-msg` | Le fichier généré `.husky/_/commit-msg` a été édité par erreur | Ne jamais modifier `.husky/_/*` (généré) ; le hook applicatif est `.husky/commit-msg` |
| Fichier téléchargé introuvable alors qu'il apparaît en base | Fichier expiré (tombstone) ou disque/base désynchronisés après une restauration partielle | Vérifier `status`/`deletedFileAt` en base ; restaurer disque et base **ensemble** (§4) |

## 9. Rotation du secret JWT

En cas de compromission suspectée ou par mesure préventive périodique :

1. Générer un nouveau secret fort (ex. `openssl rand -base64 48`).
2. Mettre à jour `JWT_SECRET` dans `.env` puis redémarrer le back-end.
3. **Effet** : tous les tokens émis avec l'ancien secret sont immédiatement invalidés — chaque utilisateur connecté devra se ré-authentifier. Aucune migration de données n'est nécessaire (le secret ne sert qu'à la vérification de signature, il n'est jamais stocké en base).
