import { Readable } from 'node:stream';
import { Test, TestingModule } from '@nestjs/testing';
import {
  GoneException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { FilesService } from './files.service';
import { StorageService } from './storage/storage.service';
import { StoredFile, type StoredFileDocument } from './schemas/file.schema';

describe('FilesService', () => {
  let service: FilesService;

  let savedAttrs: Record<string, unknown>;
  const modelInstance = {
    save: jest.fn().mockImplementation(function (
      this: Record<string, unknown>,
    ) {
      return Promise.resolve({
        _id: new Types.ObjectId(),
        tags: [],
        downloadCount: 0,
        status: 'active',
        createdAt: new Date('2026-09-10T12:00:00.000Z'),
        ...savedAttrs,
      });
    }),
  };

  // Le modèle est un constructeur (new Model()) ET un objet avec des méthodes statiques.
  const FileModel = Object.assign(
    jest.fn().mockImplementation((attrs: Record<string, unknown>) => {
      savedAttrs = attrs;
      return modelInstance;
    }),
    {
      find: jest.fn(),
      findOne: jest.fn(),
      updateOne: jest.fn(),
    },
  );

  const config = {
    get: jest.fn().mockReturnValue('http://localhost:4200'),
  } as unknown as ConfigService;

  const storage = {
    exists: jest.fn().mockReturnValue(true),
    createReadStream: jest.fn().mockReturnValue(Readable.from(['x'])),
    remove: jest.fn(),
    getRoot: jest.fn().mockReturnValue('/data/storage'),
    pathFor: jest.fn(),
  };

  /** Query Mongoose simulée : `findOne(...).exec()`. */
  const asQuery = <T>(value: T) => ({
    exec: jest.fn().mockResolvedValue(value),
  });

  const asListQuery = <T>(value: T) => ({
    sort: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(value),
  });

  /** Fabrique un document fichier. */
  function makeFileDoc(overrides: Record<string, unknown> = {}) {
    return {
      _id: new Types.ObjectId(),
      downloadToken: 'tok123',
      originalName: 'photo.jpg',
      storageKey: 'uuid-1',
      mimeType: 'image/jpeg',
      size: 5000,
      passwordHash: null,
      status: 'active',
      deletedFileAt: null,
      expiresAt: new Date(Date.now() + 3 * 86_400_000),
      downloadCount: 0,
      ...overrides,
    };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    storage.exists.mockReturnValue(true);
    storage.createReadStream.mockReturnValue(Readable.from(['x']));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: getModelToken(StoredFile.name), useValue: FileModel },
        { provide: ConfigService, useValue: config },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();
    service = module.get<FilesService>(FilesService);
  });

  const baseParams = {
    ownerId: '6aa0000000000000000000aa',
    originalName: 'photo.jpg',
    storageKey: 'uuid-1',
    mimeType: 'image/jpeg',
    size: 5000,
  };

  // ------------------------------------------------------------------ US01
  describe('createFromUpload (US01)', () => {
    it('enregistre le fichier avec un jeton, une expiration et sans mot de passe', async () => {
      const before = Date.now();
      const result = await service.createFromUpload(baseParams);
      const after = Date.now();

      expect(FileModel).toHaveBeenCalledTimes(1);
      const attrs = savedAttrs;
      expect(attrs.owner).toBe(baseParams.ownerId);
      expect(attrs.originalName).toBe('photo.jpg');
      expect(attrs.storageKey).toBe('uuid-1');
      expect(attrs.passwordHash).toBeNull();
      expect(attrs.expiresInDays).toBe(7); // défaut
      expect(typeof attrs.downloadToken).toBe('string');
      expect((attrs.downloadToken as string).length).toBe(21);

      const expiresAt = (attrs.expiresAt as Date).getTime();
      expect(expiresAt).toBeGreaterThanOrEqual(before + 7 * 86_400_000 - 1000);
      expect(expiresAt).toBeLessThanOrEqual(after + 7 * 86_400_000 + 1000);

      expect(result.isProtected).toBe(false);
      expect(result.downloadUrl).toBe(
        `http://localhost:4200/d/${result.downloadToken}`,
      );
    });

    it('hache le mot de passe quand il est fourni (bcrypt)', async () => {
      await service.createFromUpload({ ...baseParams, password: 'secret6' });

      const attrs = savedAttrs as { passwordHash: string };
      expect(attrs.passwordHash).not.toBe('secret6');
      expect(attrs.passwordHash).toMatch(/^\$2[aby]\$/);
      await expect(bcrypt.compare('secret6', attrs.passwordHash)).resolves.toBe(
        true,
      );
    });

    it('respecte expiresInDays quand il est fourni', async () => {
      const before = Date.now();
      await service.createFromUpload({ ...baseParams, expiresInDays: 2 });

      const attrs = savedAttrs as {
        expiresInDays: number;
        expiresAt: Date;
      };
      expect(attrs.expiresInDays).toBe(2);
      expect(attrs.expiresAt.getTime()).toBeGreaterThanOrEqual(
        before + 2 * 86_400_000 - 1000,
      );
    });
  });

  describe('toView', () => {
    const baseDoc = {
      _id: new Types.ObjectId(),
      originalName: 'doc.pdf',
      size: 10,
      mimeType: 'application/pdf',
      tags: ['a'],
      passwordHash: null,
      status: 'active',
      expiresAt: new Date('2026-09-17T00:00:00.000Z'),
      downloadCount: 3,
      downloadToken: 'tok123',
      createdAt: new Date('2026-09-10T00:00:00.000Z'),
    } as unknown as StoredFileDocument;

    it('expose isProtected + downloadUrl pour un fichier actif', () => {
      const view = service.toView(baseDoc);
      expect(view).toMatchObject({
        id: baseDoc._id.toString(),
        originalName: 'doc.pdf',
        isProtected: false,
        downloadToken: 'tok123',
        downloadUrl: 'http://localhost:4200/d/tok123',
        downloadCount: 3,
      });
    });

    it('marque isProtected quand un mot de passe est défini', () => {
      const view = service.toView({
        ...baseDoc,
        passwordHash: '$2b$12$x',
      } as StoredFileDocument);
      expect(view.isProtected).toBe(true);
    });

    it('masque le jeton et le lien pour un fichier expiré (tombstone)', () => {
      const view = service.toView({
        ...baseDoc,
        status: 'expired',
      } as StoredFileDocument);
      expect(view.downloadToken).toBeUndefined();
      expect(view.downloadUrl).toBeUndefined();
    });
  });

  // ------------------------------------------------------------------ US02
  describe('getMetaByToken (US02)', () => {
    it('renvoie les métadonnées publiques pour un fichier actif', async () => {
      FileModel.findOne.mockReturnValue(asQuery(makeFileDoc()));

      const meta = await service.getMetaByToken('tok123');

      expect(FileModel.findOne).toHaveBeenCalledWith({
        downloadToken: 'tok123',
      });
      expect(meta).toMatchObject({
        originalName: 'photo.jpg',
        size: 5000,
        mimeType: 'image/jpeg',
        isProtected: false,
        expired: false,
      });
    });

    it('marque isProtected quand le fichier a un mot de passe', async () => {
      FileModel.findOne.mockReturnValue(
        asQuery(makeFileDoc({ passwordHash: '$2b$12$x' })),
      );
      const meta = await service.getMetaByToken('tok123');
      expect(meta.isProtected).toBe(true);
    });

    it('lève 404 si le jeton est inconnu', async () => {
      FileModel.findOne.mockReturnValue(asQuery(null));
      await expect(service.getMetaByToken('inconnu')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('lève 410 si le fichier est expiré (date dépassée)', async () => {
      FileModel.findOne.mockReturnValue(
        asQuery(makeFileDoc({ expiresAt: new Date(Date.now() - 1000) })),
      );
      await expect(service.getMetaByToken('tok123')).rejects.toBeInstanceOf(
        GoneException,
      );
    });

    it('lève 410 si le fichier est un tombstone (status expired)', async () => {
      FileModel.findOne.mockReturnValue(
        asQuery(makeFileDoc({ status: 'expired', deletedFileAt: new Date() })),
      );
      await expect(service.getMetaByToken('tok123')).rejects.toBeInstanceOf(
        GoneException,
      );
    });
  });

  describe('prepareDownload (US02)', () => {
    it('renvoie un flux et incrémente downloadCount pour un fichier non protégé', async () => {
      const doc = makeFileDoc();
      FileModel.findOne.mockReturnValue(asQuery(doc));
      FileModel.updateOne.mockReturnValue(asQuery({ modifiedCount: 1 }));

      const result = await service.prepareDownload('tok123');

      expect(result).toMatchObject({
        originalName: 'photo.jpg',
        mimeType: 'image/jpeg',
        size: 5000,
      });
      expect(result.stream).toBeInstanceOf(Readable);
      expect(FileModel.updateOne).toHaveBeenCalledWith(
        { _id: doc._id },
        { $inc: { downloadCount: 1 } },
      );
      expect(storage.createReadStream).toHaveBeenCalledWith('uuid-1');
    });

    it('accepte le bon mot de passe pour un fichier protégé', async () => {
      const passwordHash = await bcrypt.hash('secret6', 4);
      FileModel.findOne.mockReturnValue(asQuery(makeFileDoc({ passwordHash })));
      FileModel.updateOne.mockReturnValue(asQuery({ modifiedCount: 1 }));

      await expect(
        service.prepareDownload('tok123', 'secret6'),
      ).resolves.toBeDefined();
    });

    it("lève 401 si le mot de passe est faux (et n'incrémente pas)", async () => {
      const passwordHash = await bcrypt.hash('secret6', 4);
      FileModel.findOne.mockReturnValue(asQuery(makeFileDoc({ passwordHash })));

      await expect(
        service.prepareDownload('tok123', 'mauvais'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(FileModel.updateOne).not.toHaveBeenCalled();
    });

    it('lève 401 si le mot de passe est absent pour un fichier protégé', async () => {
      const passwordHash = await bcrypt.hash('secret6', 4);
      FileModel.findOne.mockReturnValue(asQuery(makeFileDoc({ passwordHash })));

      await expect(service.prepareDownload('tok123')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('lève 404 si le jeton est inconnu', async () => {
      FileModel.findOne.mockReturnValue(asQuery(null));
      await expect(service.prepareDownload('inconnu')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('lève 410 si le fichier est expiré', async () => {
      FileModel.findOne.mockReturnValue(
        asQuery(makeFileDoc({ status: 'expired' })),
      );
      await expect(service.prepareDownload('tok123')).rejects.toBeInstanceOf(
        GoneException,
      );
    });

    it('lève 410 si le fichier a disparu du disque', async () => {
      FileModel.findOne.mockReturnValue(asQuery(makeFileDoc()));
      storage.exists.mockReturnValue(false);

      await expect(service.prepareDownload('tok123')).rejects.toBeInstanceOf(
        GoneException,
      );
    });
  });

  describe('listForUser (US05)', () => {
    /** Récupère le filtre passé au dernier `find()`. */
    const lastFilter = (): Record<string, unknown> => {
      const calls = FileModel.find.mock.calls as unknown as unknown[][];
      return (calls.at(-1)?.[0] ?? {}) as Record<string, unknown>;
    };

    it('status=all : liste tous les fichiers du propriétaire, triés par date', async () => {
      const docs = [makeFileDoc(), makeFileDoc({ originalName: 'b.pdf' })];
      const query = asListQuery(docs);
      FileModel.find.mockReturnValue(query);

      const result = await service.listForUser('owner-1', 'all');

      expect(FileModel.find).toHaveBeenCalledWith({ owner: 'owner-1' });
      expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(result.count).toBe(2);
      expect(result.items[0].originalName).toBe('photo.jpg');
    });

    it('status=active : filtre sur statut actif et date future', async () => {
      FileModel.find.mockReturnValue(asListQuery([]));
      await service.listForUser('owner-1', 'active');

      const filter = lastFilter();
      expect(filter.owner).toBe('owner-1');
      expect(filter.status).toBe('active');
      expect((filter.expiresAt as { $gt: Date }).$gt).toBeInstanceOf(Date);
    });

    it('status=expired : filtre sur tombstone OU date dépassée', async () => {
      FileModel.find.mockReturnValue(asListQuery([]));
      await service.listForUser('owner-1', 'expired');

      const filter = lastFilter();
      expect(filter.owner).toBe('owner-1');
      expect(filter.$or).toEqual([
        { status: 'expired' },
        { expiresAt: expect.any(Object) as unknown },
      ]);
    });
  });
});
