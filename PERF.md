# PERF.md — Test de performance et logs structurés

> Document produit aux étapes 5 et 6. Couvre un test de charge (k6) sur l'endpoint critique de téléchargement, la mise en place de logs structurés, et un budget de performance côté front-end (poids du bundle + audit Lighthouse).

## 1. Logs structurés

Le logger interne de NestJS a été remplacé par [`nestjs-pino`](https://github.com/iamolegga/nestjs-pino) (`backend/src/app.module.ts`, `main.ts`) : chaque requête HTTP produit désormais **une ligne JSON** avec la méthode, la route, le code de statut et la durée de traitement.

```json
{
  "level": 30,
  "time": 1789143549076,
  "req": { "id": 9, "method": "POST", "url": "/api/files/HP0.../download" },
  "res": { "statusCode": 200 },
  "responseTime": 14,
  "msg": "request completed"
}
```

- **Métriques clés directement exploitables** : `responseTime` (latence par requête), `res.statusCode` (taux d'erreur), `req.method` / `req.url` (endpoint le plus sollicité ou le plus lent). En agrégeant ces lignes (ex. via un outil comme `jq`, ou en production via un collecteur type Loki/ELK), on obtient les mêmes indicateurs qu'un APM sans dépendance externe.
- **Confidentialité** : l'en-tête `Authorization` est explicitement masqué (`redact`) — jamais de jeton JWT en clair dans les logs.
- **Format** : JSON brut si `NODE_ENV=production` (ingérable par un collecteur de logs), format lisible (`pino-pretty`) en développement.

## 2. Test de performance (k6)

### Endpoint choisi

**Téléchargement d'un fichier** (`GET /api/files/:token` puis `POST /api/files/:token/download`) : c'est l'endpoint public, non authentifié, le plus exposé (accessible à quiconque a le lien) et celui qui transfère le plus de volume — donc le plus pertinent à charger.

### Script

[`perf/k6-download-test.js`](./perf/k6-download-test.js) : une phase `setup()` crée un compte et téléverse un fichier de ~5 Mo une seule fois, puis une montée en charge (`ramping-vus`, 0 → 10 → 20 VUs sur 40 s) répète en boucle le parcours d'un destinataire (métadonnées + téléchargement) sur ce même lien.

```bash
# 1. Installer k6 (Windows) :
choco install k6          # avec les droits admin
# ou : télécharger le zip portable sur https://github.com/grafana/k6/releases

# 2. Démarrer les services
docker compose up -d
cd backend && npm run start

# 3. Lancer le test (dans un autre terminal, à la racine du repo)
k6 run perf/k6-download-test.js
```

### Résultats — configuration réelle (rate-limiting actif)

Premier run, **sans rien changer à la configuration de l'application** (limite globale : 100 requêtes/min/IP, `app.module.ts`) :

| Métrique                         | Valeur           |
| -------------------------------- | ----------------:|
| Requêtes totales                 | 880 (21,7/s)     |
| **Échecs (`http_req_failed`)**   | **77,0 %**       |
| `http_req_duration` (moy. / p95) | 8,6 ms / 55,6 ms |

**Analyse** : k6 simule 20 utilisateurs virtuels, mais tous depuis **la même adresse IP** (la machine de test) — exactement le scénario que le rate-limiting est censé bloquer. Les 77 % d'échecs sont des `429 Too Many Requests`, renvoyés en quelques millisecondes (d'où la latence moyenne très basse, trompeuse ici). **Ce n'est pas un problème de performance : c'est la protection anti-abus qui fonctionne comme prévu.** Un test de charge crédible demanderait de simuler plusieurs IP (hors de portée d'un test local en étape 5) ou de mesurer la capacité réelle du serveur séparément — voir ci-dessous.

### Résultats — capacité brute de l'endpoint (rate-limiting temporairement désactivé)

Pour mesurer la performance réelle du code (et non celle du garde-fou anti-abus), le même test a été rejoué avec la limite du `ThrottlerModule` temporairement relevée (100 000 au lieu de 100 — **modification locale, non commitée**, revenue à sa valeur d'origine immédiatement après la mesure) :

| Métrique                      | Valeur                 |
| ----------------------------- | ----------------------:|
| Requêtes totales              | 764 (18,4/s)           |
| Échecs                        | **0,0 %**              |
| Débit de données              | 2,0 Go reçus (48 Mo/s) |
| `http_req_duration` — moyenne | 93,3 ms                |
| `http_req_duration` — médiane | 31,5 ms                |
| `http_req_duration` — p90     | 300,0 ms               |
| **`http_req_duration` — p95** | **331,7 ms**           |
| `http_req_duration` — max     | 503,5 ms               |

Seuils fixés dans le script (`options.thresholds`) — **tous deux respectés** : moins de 1 % d'échecs, p95 sous 500 ms.

**Analyse** : jusqu'à 20 téléchargements concurrents d'un fichier de 5 Mo, le service reste **stable et rapide** (p95 ≈ 330 ms, aucune erreur). Le flux est servi directement depuis le disque (`fs.createReadStream`, cf. `files.service.ts`), sans le charger entièrement en mémoire — un choix qui paie ici : pas de dégradation mémoire visible sous charge. Pour un usage réel avec plusieurs utilisateurs simultanés légitimes, il faudrait ajuster la limite du rate-limiting **par utilisateur authentifié plutôt que par IP** (plusieurs collègues au bureau derrière la même IP partagent aujourd'hui le même quota) — noté comme piste d'amélioration, hors périmètre du MVP.

## 3. Budget de performance front-end

### Poids du bundle (build de production)

```bash
cd frontend
npm run build
```

| | Raw size | Estimated transfer (gzip) | Budget (`angular.json`) |
|---|---:|---:|---:|
| **Bundle initial** (chargé à la 1ʳᵉ visite) | 260,5 kB | **74,7 kB** | ⚠️ 500 kB / ❌ 1 Mo |

Le bundle initial est **près de 7 fois sous le seuil d'alerte**. Angular applique déjà ce budget à chaque build de production (`angular.json`, configuration `production`) — un dépassement ferait échouer le build (`maximumError`) avant même d'arriver en revue de code.

Le reste de l'application est **découpé par route** (lazy-loading), donc jamais téléchargé tant que l'écran correspondant n'est pas visité :

| Écran | Raw | Transfert estimé |
|---|---:|---:|
| Ajouter un fichier (upload) | 9,2 kB | 3,0 kB |
| Mes fichiers | 6,5 kB | 2,3 kB |
| Téléchargement public | 6,2 kB | 2,3 kB |
| Authentification | 6,0 kB | 2,1 kB |

### Audit Lighthouse

```bash
cd frontend && npm run build
npx serve -s dist/frontend/browser -l 5005     # ou tout autre serveur statique
npx lighthouse http://localhost:5005/ --only-categories=performance --chrome-flags="--headless=new"
```

Exécuté sur le build de production, servi en statique (Lighthouse 13.4.1, Chrome headless) :

| Métrique | Résultat |
|---|---:|
| **Score performance** | **89 / 100** |
| First Contentful Paint | 2,6 s |
| Largest Contentful Paint | 3,1 s |
| Total Blocking Time | 83 ms |
| Cumulative Layout Shift | **0** |
| Time to Interactive | 3,1 s |

**Analyse** :

- La quasi-totalité de la perte de score vient du **First/Largest Contentful Paint** (poids 62 % et 74 % du score chacun) ; le **Total Blocking Time est quasi parfait** (0,99/1) et le **CLS est nul** — le JavaScript s'exécute vite et sans bloquer le thread principal, et rien ne bouge à l'écran pendant le chargement (pas de saut de mise en page).
- Lighthouse applique par défaut un **throttling réseau et CPU simulé** (débit mobile dégradé, CPU ralenti ×4) pour évaluer l'expérience sur un terminal moyen — nettement plus sévère qu'un accès direct en local, ce qui explique des temps de peinture (FCP/LCP) plus élevés que ce que l'on observe « à l'œil » en développement.
- Le serveur statique utilisé pour ce test (`serve`) **ne compresse pas les réponses** : les tailles vues par Lighthouse sur le réseau (ex. ~165 kB pour le plus gros chunk) correspondent aux tailles **brutes**, pas gzip. Derrière un vrai reverse proxy de production (compression gzip/brotli activée), le poids réel transféré se rapprocherait des ~75 kB estimés par Angular CLI ci-dessus, et les temps de peinture seraient donc meilleurs qu'ici.
- Lighthouse identifie environ **88 Kio de JavaScript non utilisé** sur l'écran audité (probablement du code de framework non sollicité par ce premier écran) — une optimisation possible (fractionner davantage, ou différer certains imports) mais non prioritaire pour ce MVP au vu du score déjà obtenu.

### Pistes d'optimisation identifiées (non réalisées dans le MVP)

- Activer la compression HTTP (gzip/brotli) sur le reverse proxy de production.
- Réduire encore le JavaScript chargé au premier écran (≈ 88 Kio de marge identifiée par Lighthouse).
- Ajouter un cache HTTP long-terme sur les fichiers statiques — les noms de fichiers sont déjà hashés (`outputHashing: all`), ce qui le permet sans risque de servir une version obsolète.

## 4. Limites de ce test

- Réalisé en local (poste de développement), pas sur l'infrastructure de production cible — les chiffres absolus ne sont qu'indicatifs.
- Un seul endpoint back-end testé (téléchargement) et un seul écran audité côté front (celui de connexion), conformément au périmètre minimal fixé pour cette étape.
- Le rate-limiting par IP n'a pas été fondamentalement remis en cause côté back — seulement documenté comme facteur dominant du premier résultat.
- L'audit Lighthouse a été fait sur un serveur statique sans compression : les métriques de poids réseau sont donc pessimistes par rapport à un déploiement de production réel.
