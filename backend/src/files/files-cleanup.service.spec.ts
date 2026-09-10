import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { FilesCleanupService } from './files-cleanup.service';
import { StorageService } from './storage/storage.service';
import { StoredFile } from './schemas/file.schema';

describe('FilesCleanupService', () => {
  let service: FilesCleanupService;

  const exec = <T>(value: T) => ({ exec: jest.fn().mockResolvedValue(value) });

  const FileModel = {
    find: jest.fn(),
    updateOne: jest.fn(),
    deleteMany: jest.fn(),
  };
  const storage = { remove: jest.fn() };

  const overdueDoc = (over: Record<string, unknown> = {}) => ({
    _id: new Types.ObjectId(),
    storageKey: 'uuid-1',
    status: 'active',
    expiresAt: new Date(Date.now() - 1000),
    ...over,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesCleanupService,
        { provide: getModelToken(StoredFile.name), useValue: FileModel },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();
    service = module.get(FilesCleanupService);
  });

  describe('expireOverdueFiles', () => {
    it('transforme chaque fichier échu en tombstone et efface son contenu', async () => {
      const doc = overdueDoc();
      FileModel.find.mockReturnValue(exec([doc]));
      FileModel.updateOne.mockReturnValue(exec({ modifiedCount: 1 }));
      const now = new Date('2026-09-20T03:00:00.000Z');

      const count = await service.expireOverdueFiles(now);

      expect(count).toBe(1);
      expect(FileModel.find).toHaveBeenCalledWith({
        status: 'active',
        expiresAt: { $lte: now },
      });
      expect(storage.remove).toHaveBeenCalledWith('uuid-1');
      expect(FileModel.updateOne).toHaveBeenCalledWith(
        { _id: doc._id },
        {
          $set: {
            status: 'expired',
            deletedFileAt: now,
            passwordHash: null,
          },
          $unset: { downloadToken: '', storageKey: '' },
        },
      );
    });

    it("ne fait rien s'il n'y a aucun fichier échu", async () => {
      FileModel.find.mockReturnValue(exec([]));
      const count = await service.expireOverdueFiles();
      expect(count).toBe(0);
      expect(storage.remove).not.toHaveBeenCalled();
      expect(FileModel.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('purgeOldTombstones', () => {
    it('supprime les tombstones plus vieux que 30 jours', async () => {
      FileModel.deleteMany.mockReturnValue(exec({ deletedCount: 3 }));
      const now = new Date('2026-10-01T00:00:00.000Z');

      const count = await service.purgeOldTombstones(now);

      expect(count).toBe(3);
      const calls = FileModel.deleteMany.mock.calls as unknown as {
        status: string;
        deletedFileAt: { $lte: Date };
      }[][];
      const filter = calls[0][0];
      expect(filter.status).toBe('expired');
      expect(filter.deletedFileAt.$lte.getTime()).toBe(
        now.getTime() - 30 * 24 * 60 * 60 * 1000,
      );
    });
  });

  describe('handleCleanup', () => {
    it('enchaîne expiration puis purge', async () => {
      FileModel.find.mockReturnValue(exec([]));
      FileModel.deleteMany.mockReturnValue(exec({ deletedCount: 0 }));

      await service.handleCleanup();

      expect(FileModel.find).toHaveBeenCalled();
      expect(FileModel.deleteMany).toHaveBeenCalled();
    });
  });
});
