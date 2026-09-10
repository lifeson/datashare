import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  type ReadStream,
} from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/**
 * Abstraction du stockage des fichiers.
 * Implémentation actuelle : système de fichiers local.
 * Un passage vers un stockage objet (S3, MinIO…) ne changerait que cette classe.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = resolve(
      process.cwd(),
      config.get<string>('STORAGE_DIR', '../storage'),
    );
    if (!existsSync(this.root)) {
      mkdirSync(this.root, { recursive: true });
      this.logger.log(`Répertoire de stockage créé : ${this.root}`);
    }
  }

  /** Répertoire racine du stockage (utilisé par la configuration Multer). */
  getRoot(): string {
    return this.root;
  }

  /** Chemin absolu d'un fichier stocké. */
  pathFor(storageKey: string): string {
    return join(this.root, storageKey);
  }

  exists(storageKey: string): boolean {
    return existsSync(this.pathFor(storageKey));
  }

  createReadStream(storageKey: string): ReadStream {
    return createReadStream(this.pathFor(storageKey));
  }

  /** Supprime le fichier ; silencieux s'il n'existe déjà plus. */
  async remove(storageKey: string): Promise<void> {
    try {
      await unlink(this.pathFor(storageKey));
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code !== 'ENOENT') {
        this.logger.warn(
          `Suppression impossible pour ${storageKey} : ${e.message}`,
        );
      }
    }
  }
}
