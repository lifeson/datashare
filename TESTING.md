# TESTING.md — Plan et suivi des tests

> Document vivant. Il s'étoffe à chaque User Story et sera consolidé à l'étape 5
> (tests e2e Cypress, critères d'acceptation détaillés, rapport de couverture).

## 1. Stratégie

| Niveau | Outil | Portée |
|---|---|---|
| Unitaire back-end | **Jest** (`backend/`) | Services et logique métier, dépendances simulées (mocks) — **pas de base de données** |
| Unitaire front-end | **Vitest** (`frontend/`, via `@angular/build:unit-test`) | Services et composants Angular, HTTP simulé (`HttpTestingController`) |
| Intégration API | **Supertest** (à venir, étape 5) | Endpoints réels avec base de test |
| End-to-end | **Cypress** (à venir, étape 5) | Parcours utilisateur complets (≥ 2-3 scénarios critiques) |

**Objectif de couverture** : ≥ 70 % (indicatif), mesuré via `npm run test:cov`.

## 2. Exécution

```bash
# Back-end
cd backend
npm test              # tous les tests unitaires
npm run test:cov      # avec rapport de couverture (dossier coverage/)

# Front-end
cd frontend
npm test              # exécution unique
npm run test:watch    # mode continu
```

## 3. Fonctionnalités critiques et couverture

| Réf | Fonctionnalité critique | US | Testée par | État |
|---|---|:---:|---|:---:|
| C1 | Hachage bcrypt du mot de passe ; jamais stocké ni renvoyé en clair | US03 | `auth.service.spec.ts` (2 cas) | ✅ |
| C2 | Unicité de l'email (409 si déjà pris) | US03 | `auth.service.spec.ts` | ✅ |
| C3 | Vérification des identifiants au login (même message si email inconnu ou mot de passe faux) | US04 | `auth.service.spec.ts` (4 cas) | ✅ |
| C4 | Émission du JWT — payload `{ sub, email }` signé | US03/US04 | `auth.service.spec.ts` (register + login) | ✅ |
| C5 | Validation des DTO (`RegisterDto`, `LoginDto`) | US03/US04 | validée manuellement via `/api/docs` ; test automatisé étape 5 | ⏳ |
| C6 | Protection des routes (`JwtStrategy` + `JwtAuthGuard`) | US04 | `jwt.strategy.spec.ts` (2 cas) | ✅ |

## 4. Détail des tests par User Story

### US03 — Création de compte

| Fichier | Cas de test | Vérifie |
|---|---|---|
| `users/users.service.spec.ts` | `create` normalise l'email (minuscule + trim) et enregistre | Normalisation, appel `save()` |
| | `create` laisse `name` à `undefined` si non fourni | Champ optionnel |
| | `findByEmail` cherche par email normalisé | Cohérence de la recherche |
| | `findById` délègue à `Model.findById` | — |
| `auth/auth.service.spec.ts` | `register` crée le compte et renvoie `{ accessToken, user }` | Chemin nominal |
| | `register` signe un JWT avec `{ sub, email }` | **C4** |
| | `register` hache le mot de passe — jamais en clair | **C1** |
| | `register` ne renvoie jamais `passwordHash` | **C1** |
| | `register` rejette avec `409` si l'email est déjà utilisé | **C2** |

**Critères d'acceptation US03** (rappel spécifications) :
- L'email doit être unique et au format valide.
- Le mot de passe fait au moins 8 caractères et est stocké haché + salé.
- À l'inscription, un token JWT est émis.

### US04 — Connexion

| Fichier | Cas de test | Vérifie |
|---|---|---|
| `auth/auth.service.spec.ts` | `login` renvoie `{ accessToken, user }` si identifiants valides | Chemin nominal, pas de `passwordHash` dans la réponse |
| | `login` rejette `401` si le mot de passe est faux | **C3** |
| | `login` rejette `401` si l'email est inconnu | **C3** |
| | `login` renvoie **le même message** pour « email inconnu » et « mot de passe faux » | **C3** (anti-énumération) |
| | `getProfile` renvoie la vue publique de l'utilisateur | Route `/auth/me` |
| | `getProfile` rejette `401` si l'utilisateur n'existe plus | Révocation |
| `auth/strategies/jwt.strategy.spec.ts` | `validate` renvoie `{ userId, email }` si l'utilisateur du token existe | **C6** |
| | `validate` rejette `401` si l'utilisateur n'existe plus | **C6** |

**Critères d'acceptation US04** (rappel spécifications) :
- Authentification email + mot de passe, comparaison avec le hash stocké.
- Un token JWT est généré et transmis au client.
- Aucune distinction entre « email inconnu » et « mot de passe incorrect » (sécurité).

### US01 — Téléversement (back-end)

| Fichier | Cas de test | Vérifie |
|---|---|---|
| `files/files.service.spec.ts` | `createFromUpload` : jeton `nanoid` (21), `expiresAt` calculé, `expiresInDays` défaut 7 | Génération du lien, expiration |
| | hache le mot de passe du fichier (bcrypt) quand fourni | Sécurité (US09) |
| | `toView` masque `downloadToken` / `downloadUrl` pour un fichier expiré | Tombstone |
| `files/storage/storage.service.spec.ts` | `pathFor`, création du répertoire, `remove` tolérant à `ENOENT` | Abstraction de stockage |

### US02 — Téléchargement via lien (back-end)

| Fichier | Cas de test | Vérifie |
|---|---|---|
| `files/files.service.spec.ts` | `getMetaByToken` : métadonnées d'un fichier actif · `isProtected` · `404` jeton inconnu · `410` date dépassée · `410` tombstone | Contrôle d'accès public |
| | `prepareDownload` : renvoie le flux + `downloadCount++` (fichier non protégé) · bon mot de passe accepté · `401` mot de passe faux **sans** incrément · `401` mot de passe absent · `404` jeton inconnu · `410` expiré · `410` fichier absent du disque | Sécurité, comptage, vérification paresseuse |

### US02 — Téléchargement via lien (front-end)

| Fichier | Cas de test | Vérifie |
|---|---|---|
| `features/download/download-page.spec.ts` | Métadonnées affichées (nom, taille, bandeau d'expiration) · champ mot de passe + bouton désactivé si protégé · bannière « expiré » sur `410` · « Lien invalide » sur `404` · téléchargement déclenché au clic · message sur mot de passe incorrect `401` | Écran `/d/:token` |

### US05 — Historique « Mes fichiers »

| Fichier | Cas de test | Vérifie |
|---|---|---|
| `files/files.service.spec.ts` | `listForUser` : `status=all` → filtre `{ owner }` + tri `createdAt: -1` · `status=active` → `status: 'active'` + `expiresAt.$gt` · `status=expired` → `$or` tombstone / date dépassée | Filtres de l'historique (back) |
| `features/my-files/my-files-page.spec.ts` | Chargement de l'onglet « Tous » au démarrage · lien « Accéder » sur un fichier actif · message « n'est plus stocké chez nous » sur un fichier expiré (pas de lien) · rechargement au changement d'onglet · état vide | Écran « Mes fichiers » (front) |

### US06 — Suppression d'un fichier

| Fichier | Cas de test | Vérifie |
|---|---|---|
| `files/files.service.spec.ts` | `deleteForUser` : supprime le fichier disque **puis** le document pour le propriétaire · `404` id mal formé · `404` fichier absent · `403` si non-propriétaire (sans `deleteOne`) | Suppression sécurisée (back) |
| `features/my-files/my-files-page.spec.ts` | clic « Supprimer » + confirmation → appel `remove()` + rechargement · confirmation annulée → aucun appel | Bouton Supprimer (front) |

### US10 — Expiration automatique

| Fichier | Cas de test | Vérifie |
|---|---|---|
| `files/files-cleanup.service.spec.ts` | `expireOverdueFiles` : fichier échu → tombstone (`$unset` jeton/clé, `passwordHash: null`) + `storage.remove` · aucun échu → aucune action · `purgeOldTombstones` : `deleteMany` avec cutoff à 30 j · `handleCleanup` enchaîne les deux | Tâche CRON d'expiration |

### US01 / US03 / US04 — Front-end (Angular)

| Fichier | Cas de test | Vérifie |
|---|---|---|
| `core/utils/file-size.spec.ts` | Formatage « 2,6 Mo », arrondis | Affichage des tailles |
| `features/upload/upload-page.spec.ts` | Rendu des 3 états (accueil / formulaire / succès), blocage > 1 Go, appel API + lien, message d'erreur `401` | Écran de téléversement (US01) |
| `core/auth/auth.service.spec.ts` | `login` / `register` stockent le token et l'utilisateur ; `logout` vide tout + `localStorage` ; `GET /auth/me` au démarrage ; déconnexion sur `401` | Session client |
| `features/auth/auth-page.spec.ts` | Modes Connexion / Créer un compte, mots de passe différents → bouton désactivé, connexion réussie → redirection, message clair sur `409` | Écrans d'auth (US03/US04) |

## 5. Couverture actuelle

- **Back-end** : `npm run test:cov` — 52 tests, 7 suites. `auth.service.ts`, `jwt.strategy.ts`, `files.service.ts` et `files-cleanup.service.ts` à ~100 %, `storage.service.ts` ~86 %.
- **Front-end** : `npm test` — 32 tests, 7 suites (Vitest).

Les contrôleurs, modules, guards et décorateurs (back), ainsi que l'intégration front↔back, seront couverts par les **tests d'intégration (Supertest)** et **e2e (Cypress)** à l'étape 5. Objectif global 70 % visé à ce moment-là.
