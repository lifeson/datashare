import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Connection } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Parcours critique DataShare (intégration HTTP)', () => {
  let app: INestApplication<App>;
  let server: App;

  // Email unique par exécution : un run précédent interrompu avant le nettoyage
  // ne provoque pas un faux 409 « email déjà utilisé ».
  const email = `e2e-${Date.now()}@test.datashare.local`;
  const password = 'MotDePasse123!';

  let accessToken: string;
  let downloadToken: string;
  let fileId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // `createNestApplication()` n'applique pas la configuration de `src/main.ts` :
    // on répète ici le préfixe global et la pipe de validation, indispensables
    // aux tests (routes sous /api, rejet des payloads invalides).
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    const connection = app.get<Connection>(getConnectionToken());
    await connection.dropDatabase();
    await app.close();
    await rm(join(tmpdir(), 'datashare-e2e-storage'), {
      recursive: true,
      force: true,
    });
  });

  describe('Authentification (US03 / US04)', () => {
    it('rejette une inscription avec un email invalide (400)', async () => {
      await request(server)
        .post('/api/auth/register')
        .send({ email: 'pas-un-email', password })
        .expect(400);
    });

    it('crée un compte et renvoie un token exploitable (201)', async () => {
      const res = await request(server)
        .post('/api/auth/register')
        .send({ email, password })
        .expect(201);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({ email });
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('rejette une deuxième inscription avec le même email (409)', async () => {
      await request(server)
        .post('/api/auth/register')
        .send({ email, password })
        .expect(409);
    });

    it('rejette un mot de passe incorrect au login (401)', async () => {
      await request(server)
        .post('/api/auth/login')
        .send({ email, password: 'un-autre-mot-de-passe' })
        .expect(401);
    });

    it('connecte l’utilisateur et renvoie un token (200)', async () => {
      const res = await request(server)
        .post('/api/auth/login')
        .send({ email, password })
        .expect(200);

      accessToken = res.body.accessToken as string;
      expect(accessToken).toEqual(expect.any(String));
    });
  });

  describe('Téléversement et téléchargement (US01 / US02)', () => {
    it('refuse un téléversement sans jeton (401)', async () => {
      await request(server)
        .post('/api/files')
        .attach('file', Buffer.from('contenu'), 'sans-token.txt')
        .expect(401);
    });

    it('téléverse un fichier et renvoie un lien de téléchargement (201)', async () => {
      const res = await request(server)
        .post('/api/files')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('expiresInDays', '7')
        .attach(
          'file',
          Buffer.from('contenu du fichier de test e2e'),
          'rapport.txt',
        )
        .expect(201);

      expect(res.body.id).toEqual(expect.any(String));
      expect(res.body.downloadToken).toEqual(expect.any(String));
      fileId = res.body.id as string;
      downloadToken = res.body.downloadToken as string;
    });

    it('expose les métadonnées publiques du fichier (200)', async () => {
      const res = await request(server)
        .get(`/api/files/${downloadToken}`)
        .expect(200);

      expect(res.body.originalName).toBe('rapport.txt');
      expect(res.body.isProtected).toBe(false);
    });

    it('télécharge le fichier : le contenu reçu correspond à celui envoyé (200)', async () => {
      const res = await request(server)
        .post(`/api/files/${downloadToken}/download`)
        .expect(200);

      expect(res.text).toBe('contenu du fichier de test e2e');
    });
  });

  describe('Suppression (US06)', () => {
    it('refuse la suppression par un autre compte (403)', async () => {
      const otherEmail = `e2e-other-${Date.now()}@test.datashare.local`;
      const other = await request(server)
        .post('/api/auth/register')
        .send({ email: otherEmail, password })
        .expect(201);

      await request(server)
        .delete(`/api/files/${fileId}`)
        .set('Authorization', `Bearer ${other.body.accessToken as string}`)
        .expect(403);
    });

    it('le propriétaire supprime le fichier (204), son lien devient invalide (404)', async () => {
      await request(server)
        .delete(`/api/files/${fileId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      await request(server).get(`/api/files/${downloadToken}`).expect(404);
    });
  });
});
