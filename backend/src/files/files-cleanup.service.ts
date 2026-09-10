import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { TOMBSTONE_RETENTION_DAYS } from './constants';
import { StoredFile, StoredFileDocument } from './schemas/file.schema';
import { StorageService } from './storage/storage.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/** US10 — expiration automatique et purge des tombstones. */
@Injectable()
export class FilesCleanupService {
  private readonly logger = new Logger(FilesCleanupService.name);

  constructor(
    @InjectModel(StoredFile.name)
    private readonly fileModel: Model<StoredFileDocument>,
    private readonly storage: StorageService,
  ) {}

  /** Chaque jour à 03:00. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'files-cleanup' })
  //@Cron(CronExpression.EVERY_30_SECONDS, { name: 'files-cleanup' })
  async handleCleanup(): Promise<void> {
    const expired = await this.expireOverdueFiles();
    const purged = await this.purgeOldTombstones();
    if (expired > 0 || purged > 0) {
      this.logger.log(
        `Nettoyage : ${expired} fichier(s) expiré(s), ${purged} tombstone(s) purgé(s).`,
      );
    }
  }

  /** Passe en tombstone les fichiers échus et supprime leur contenu du disque. */
  async expireOverdueFiles(now: Date = new Date()): Promise<number> {
    const overdue = await this.fileModel
      .find({ status: 'active', expiresAt: { $lte: now } })
      .exec();

    for (const file of overdue) {
      if (file.storageKey) {
        await this.storage.remove(file.storageKey);
      }
      await this.fileModel
        .updateOne(
          { _id: file._id },
          {
            $set: { status: 'expired', deletedFileAt: now, passwordHash: null },
            $unset: { downloadToken: '', storageKey: '' },
          },
        )
        .exec();
    }
    return overdue.length;
  }

  /** Supprime définitivement les tombstones plus vieux que la rétention. */
  async purgeOldTombstones(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - TOMBSTONE_RETENTION_DAYS * DAY_MS);
    const result = await this.fileModel
      .deleteMany({ status: 'expired', deletedFileAt: { $lte: cutoff } })
      .exec();
    return result.deletedCount ?? 0;
  }
}
