import http from 'k6/http';
import { check, sleep } from 'k6';

// URL du back-end à tester (démarré séparément : `cd backend && npm run start`).
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  scenarios: {
    download_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 10 }, // montée en charge
        { duration: '20s', target: 20 }, // palier
        { duration: '10s', target: 0 }, // retour au calme
      ],
    },
  },
  // Seuils : le test échoue (exit code non nul) s'ils ne sont pas tenus —
  // utile en CI, pas seulement pour lire le rapport a posteriori.
  thresholds: {
    http_req_failed: ['rate<0.01'], // moins de 1 % d'erreurs
    http_req_duration: ['p(95)<500'], // 95 % des requêtes sous 500 ms
  },
};

/**
 * `setup()` s'exécute une seule fois avant la montée en charge : crée un
 * compte et téléverse le fichier que tous les VUs vont ensuite télécharger
 * en boucle. Le téléversement lui-même n'est pas mesuré (ce n'est pas
 * l'endpoint testé ici).
 */
export function setup() {
  const email = `k6-${Date.now()}@test.datashare.local`;
  const password = 'MotDePasse123!';

  const registerRes = http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  const accessToken = registerRes.json('accessToken');

  // ~5 Mo : taille réaliste pour un document partagé (le plafond applicatif est 1 Go).
  const fileContent = 'x'.repeat(5 * 1024 * 1024);
  const uploadRes = http.post(
    `${BASE_URL}/api/files`,
    {
      file: http.file(fileContent, 'perf-test.bin', 'application/octet-stream'),
      expiresInDays: '1',
    },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const downloadToken = uploadRes.json('downloadToken');

  return { downloadToken };
}

/** Exécuté en boucle par chaque VU actif : le parcours d'un destinataire. */
export default function (data) {
  const metaRes = http.get(`${BASE_URL}/api/files/${data.downloadToken}`);
  check(metaRes, { 'métadonnées → 200': (r) => r.status === 200 });

  const dlRes = http.post(`${BASE_URL}/api/files/${data.downloadToken}/download`);
  check(dlRes, {
    'téléchargement → 200': (r) => r.status === 200,
    'contenu bien reçu (~5 Mo)': (r) => r.body.length > 5 * 1024 * 1024 - 1,
  });

  sleep(1);
}
