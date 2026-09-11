# SECURITY.md — Scan de sécurité et mesures en place

> Document vivant, complété à l'étape 5. Combine un scan automatisé des dépendances (`npm audit`) et un rappel des mesures de sécurité déjà implémentées dans le code (conçues dès l'étape 1, cf. `docs/etape-1/01-architecture-technique.md`).

## 1. Scan des dépendances (`npm audit`)

| Projet | Commande | Résultat |
|---|---|---|
| `backend/` | `npm audit` | **0 vulnérabilité** (après correctif, voir ci-dessous — 7 vulnérabilités hautes avant) |
| `frontend/` | `npm audit` | **0 vulnérabilité** |

### Vulnérabilité trouvée et corrigée

**`backend/` — 7 alertes de sévérité haute, 4 CVE distinctes sur `multer`** ([GHSA-wc9g-mqfw-jrwm](https://github.com/advisories/GHSA-wc9g-mqfw-jrwm), [GHSA-qfvm-cv95-jqjf](https://github.com/advisories/GHSA-qfvm-cv95-jqjf), [GHSA-qvfw-j98x-7q72](https://github.com/advisories/GHSA-qvfw-j98x-7q72), [GHSA-535w-7cp7-47q4](https://github.com/advisories/GHSA-535w-7cp7-47q4)) : déni de service via des noms de champs multipart forgés, fuite de descripteur de fichier sur upload interrompu, contournement de la limite de taille par une condition de course, déni de service par index de tableau surdimensionné dans les noms de champs.

- **Cause** : notre dépendance directe `multer@2.3.0` (utilisée dans `files.module.ts` pour `diskStorage`) n'est **pas** concernée par ces CVE (corrigées depuis 2.3.0). Mais `@nestjs/platform-express` embarque **sa propre copie interne** de `multer`, épinglée en dur à la version `2.2.0` — c'est ce moteur interne (pas le nôtre) qui traite réellement les requêtes multipart entrantes via `FileInterceptor`. Notre application était donc bien exposée, malgré une dépendance directe à jour.
- **Correctif** : ajout d'un `overrides` dans `backend/package.json` pour forcer **toute** résolution de `multer` (y compris la copie interne de `@nestjs/platform-express`) vers `^2.3.0` :
  ```json
  "overrides": {
    "multer": "^2.3.0"
  }
  ```
  Alternative rejetée : `npm audit fix --force` proposait de rétrograder `@nestjs/core` en version **7** — une régression majeure qui aurait annulé toute la migration vers NestJS 11. L'`overrides` cible précisément le paquet vulnérable sans toucher au framework.
- **Vérification** : `npm audit` → 0 vulnérabilité ; suite complète (52 tests unitaires, 11 tests d'intégration, `npm run build`) toujours au vert après le changement — l'interface `StorageEngine` de `multer` est stable entre 2.2.0 et 2.3.0 (montée de version mineure).

### Ce qui n'est pas couvert par `npm audit`

`npm audit` ne couvre que les paquets npm connus du registre. Il ne couvre pas l'image Docker `mongo:7` (à mettre à jour périodiquement via `docker compose pull`) ni le système d'exploitation hôte — hors périmètre d'un scan de dépendances applicatives.

## 2. Mesures de sécurité déjà en place (rappel)

Le scan ci-dessus complète — il ne remplace pas — les protections conçues dans le code depuis l'étape 1 :

| Mesure | Où |
|---|---|
| Mots de passe (comptes et fichiers) hachés avec `bcrypt` (coût 12), jamais stockés ni renvoyés en clair | `auth.service.ts`, `files.service.ts` |
| Jetons de téléchargement non prédictibles (`nanoid`, 21 caractères, ~124 bits d'entropie) | `files.service.ts` |
| Authentification par JWT (24h), routes privées protégées par `JwtAuthGuard` | `auth/`, `files.controller.ts` |
| Anti-énumération : même message d'erreur pour « email inconnu » et « mot de passe incorrect » | `auth.service.ts` |
| Limitation de débit (rate-limiting) : 10 requêtes/min sur l'authentification, 100/min globalement | `app.module.ts`, `auth.controller.ts` |
| Liste d'extensions interdites appliquée **avant** l'écriture sur disque (`fileFilter` Multer) | `files.module.ts` |
| Taille de fichier limitée à 1 Gio | `files.module.ts` |
| Nom de fichier sur disque généré côté serveur (UUID), aucune dépendance au nom fourni par le client — élimine tout risque de *path traversal* | `files.module.ts` |
| En-têtes de sécurité HTTP (`helmet`) et CORS restreint à l'origine du front | `main.ts` |
| Validation stricte des entrées (`ValidationPipe` globale, `whitelist` + `forbidNonWhitelisted`) | `main.ts` |
| Suppression : réservée au propriétaire du fichier (`403` sinon), vérifié côté serveur | `files.service.ts` |

## 3. Suivi

Un nouveau `npm audit` (backend et frontend) est à relancer à chaque mise à jour de dépendances — voir la procédure dans [`MAINTENANCE.md`](./MAINTENANCE.md#5-mise-à-jour-des-dépendances).
