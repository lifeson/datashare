import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

jest.mock('node:fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  createReadStream: jest.fn(),
}));
jest.mock('node:fs/promises', () => ({
  unlink: jest.fn(),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs') as {
  existsSync: jest.Mock;
  mkdirSync: jest.Mock;
};
const fsp = require('node:fs/promises') as { unlink: jest.Mock };
/* eslint-enable @typescript-eslint/no-require-imports */

function makeService(dir = '/data/storage'): StorageService {
  const config = {
    get: jest.fn().mockReturnValue(dir),
  } as unknown as ConfigService;
  return new StorageService(config);
}

describe('StorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(true); // répertoire présent par défaut
  });

  it("ne crée pas le répertoire s'il existe déjà", () => {
    makeService();
    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });

  it("crée le répertoire de stockage s'il est absent", () => {
    fs.existsSync.mockReturnValue(false);
    makeService();
    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), {
      recursive: true,
    });
  });

  it('pathFor concatène la racine et la clé', () => {
    const service = makeService();
    expect(service.pathFor('abc')).toBe(join(service.getRoot(), 'abc'));
  });

  it('remove ignore un fichier déjà absent (ENOENT)', async () => {
    const service = makeService();
    fsp.unlink.mockRejectedValueOnce(
      Object.assign(new Error('nope'), { code: 'ENOENT' }),
    );

    await expect(service.remove('abc')).resolves.toBeUndefined();
  });

  it('remove appelle unlink avec le bon chemin', async () => {
    const service = makeService();
    fsp.unlink.mockResolvedValueOnce(undefined);

    await service.remove('abc');

    expect(fsp.unlink).toHaveBeenCalledWith(expect.stringContaining('abc'));
  });
});
