import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Exécuté par Jest AVANT que `AppModule` (et donc `ConfigModule.forRoot`) ne soit
// chargé : `dotenv` ne réécrit jamais une variable déjà présente dans `process.env`,
// ces valeurs ont donc toujours priorité sur `backend/.env`.
process.env.MONGODB_URI = 'mongodb://localhost:27017/datashare_test';
process.env.JWT_SECRET = 'e2e-test-secret-do-not-use-in-prod';
process.env.JWT_EXPIRES_IN = '1h';
process.env.STORAGE_DIR = join(tmpdir(), 'datashare-e2e-storage');
process.env.MAX_FILE_SIZE = '1073741824';
