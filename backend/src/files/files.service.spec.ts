import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { FilesService } from './files.service';
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
  const FileModel = jest
    .fn()
    .mockImplementation((attrs: Record<string, unknown>) => {
      savedAttrs = attrs;
      return modelInstance;
    });

  const config = {
    get: jest.fn().mockReturnValue('http://localhost:4200'),
  } as unknown as ConfigService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: getModelToken(StoredFile.name), useValue: FileModel },
        { provide: ConfigService, useValue: config },
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
});
