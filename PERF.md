# PERF.md — Test de performance et logs structurés

> Document produit à l'étape 5. Couvre un test de charge (k6) sur l'endpoint critique de téléchargement, et la mise en place de logs structurés pour en analyser les métriques clés.

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

## 3. Limites de ce test

- Réalisé en local (poste de développement), pas sur l'infrastructure de production cible — les chiffres absolus ne sont qu'indicatifs.
- Un seul endpoint testé (téléchargement), conformément au périmètre minimal fixé pour cette étape.
- Le rate-limiting par IP n'a pas été fondamentalement remis en cause — seulement documenté comme facteur dominant du premier résultat.
