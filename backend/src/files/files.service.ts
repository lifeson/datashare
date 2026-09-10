import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import {
  DEFAULT_EXPIRY_DAYS,
  DOWNLOAD_TOKEN_LENGTH,
  FILE_BCRYPT_ROUNDS,
} from './constants';
import { StoredFile, StoredFileDocument } from './schemas/file.schema';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Vue d'un fichier renvoyée par l'API (US01, réutilisée par US05). */
export interface FileItemView {
  id: string;
  originalName: string;
  size: number;
  mimeType: string;
  tags: string[];
  isProtected: boolean;
  status: string;
  expiresAt: Date;
  downloadCount: number;
  downloadToken?: string;
  downloadUrl?: string;
  createdAt: Date;
}

export interface CreateFromUploadParams {
  ownerId: string;
  originalName: string;
  storageKey: string;
  mimeType: string;
  size: number;
  password?: string;
  expiresInDays?: number;
}

@Injectable()
export class FilesService {
  private readonly publicBaseUrl: string;

  constructor(
    @InjectModel(StoredFile.name)
    private readonly fileModel: Model<StoredFileDocument>,
    config: ConfigService,
  ) {
    this.publicBaseUrl = config
      .get<string>('PUBLIC_BASE_URL', 'http://localhost:4200')
      .replace(/\/+$/, '');
  }

  /** US01 — Enregistre un fichier téléversé et génère son lien. */
  async createFromUpload(
    params: CreateFromUploadParams,
  ): Promise<FileItemView> {
    const expiresInDays = params.expiresInDays ?? DEFAULT_EXPIRY_DAYS;
    const passwordHash = params.password
      ? await bcrypt.hash(params.password, FILE_BCRYPT_ROUNDS)
      : null;

    const file = new this.fileModel({
      owner: params.ownerId,
      originalName: params.originalName,
      storageKey: params.storageKey,
      mimeType: params.mimeType,
      size: params.size,
      downloadToken: nanoid(DOWNLOAD_TOKEN_LENGTH),
      passwordHash,
      expiresInDays,
      expiresAt: new Date(Date.now() + expiresInDays * DAY_MS),
    });
    const saved = await file.save();

    return this.toView(saved);
  }

  /** Mappe un document vers la vue publique de l'API. */
  toView(doc: StoredFileDocument): FileItemView {
    const isExpired = doc.status === 'expired';
    return {
      id: doc._id.toString(),
      originalName: doc.originalName,
      size: doc.size,
      mimeType: doc.mimeType,
      tags: doc.tags,
      isProtected: doc.passwordHash !== null,
      status: doc.status,
      expiresAt: doc.expiresAt,
      downloadCount: doc.downloadCount,
      downloadToken: isExpired ? undefined : doc.downloadToken,
      downloadUrl:
        isExpired || !doc.downloadToken
          ? undefined
          : `${this.publicBaseUrl}/d/${doc.downloadToken}`,
      createdAt: doc.createdAt,
    };
  }
}
