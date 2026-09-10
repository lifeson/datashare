import {
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import {
  DEFAULT_EXPIRY_DAYS,
  DOWNLOAD_TOKEN_LENGTH,
  FILE_BCRYPT_ROUNDS,
} from './constants';
import { StoredFile, StoredFileDocument } from './schemas/file.schema';
import { Readable } from 'node:stream';
import { StorageService } from './storage/storage.service';

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

/** Métadonnées publiques d'un fichier (US02, avant téléchargement). */
export interface FileMeta {
  originalName: string;
  size: number;
  mimeType: string;
  isProtected: boolean;
  expiresAt: Date;
  expired: boolean;
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
    private readonly storage: StorageService,
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

  /** Un fichier est indisponible s'il est marqué expiré, purgé, ou si sa date est passée. */
  private isExpired(file: StoredFileDocument): boolean {
    return (
      file.status === 'expired' ||
      file.deletedFileAt !== null ||
      file.expiresAt.getTime() < Date.now()
    );
  }

  /** US02 — Métadonnées publiques par jeton. */
  async getMetaByToken(token: string): Promise<FileMeta> {
    const file = await this.fileModel.findOne({ downloadToken: token }).exec();
    if (!file) {
      throw new NotFoundException('Lien invalide.');
    }
    if (this.isExpired(file)) {
      throw new GoneException(
        "Ce fichier n'est plus disponible en téléchargement car il a expiré.",
      );
    }
    return {
      originalName: file.originalName,
      size: file.size,
      mimeType: file.mimeType,
      isProtected: file.passwordHash !== null,
      expiresAt: file.expiresAt,
      expired: false,
    };
  }

  /** US02 — Prépare le flux de téléchargement (après contrôle du mot de passe). */
  async prepareDownload(
    token: string,
    password?: string,
  ): Promise<{
    stream: Readable;
    originalName: string;
    mimeType: string;
    size: number;
  }> {
    const file = await this.fileModel.findOne({ downloadToken: token }).exec();
    if (!file) {
      throw new NotFoundException('Lien invalide.');
    }
    if (this.isExpired(file)) {
      throw new GoneException(
        "Ce fichier n'est plus disponible en téléchargement car il a expiré.",
      );
    }
    if (file.passwordHash) {
      const ok = password
        ? await bcrypt.compare(password, file.passwordHash)
        : false;
      if (!ok) {
        throw new UnauthorizedException('Mot de passe incorrect ou requis.');
      }
    }
    if (!this.storage.exists(file.storageKey)) {
      throw new GoneException("Ce fichier n'est plus disponible.");
    }

    await this.fileModel
      .updateOne({ _id: file._id }, { $inc: { downloadCount: 1 } })
      .exec();

    return {
      stream: this.storage.createReadStream(file.storageKey),
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
    };
  }

  /** US05 — Fichiers de l'utilisateur, filtrés par statut, du plus récent au plus ancien. */
  async listForUser(
    ownerId: string,
    status: 'all' | 'active' | 'expired',
  ): Promise<{ items: FileItemView[]; count: number }> {
    const now = new Date();

    let filter: Record<string, unknown> = { owner: ownerId };
    if (status === 'active') {
      filter = { owner: ownerId, status: 'active', expiresAt: { $gt: now } };
    } else if (status === 'expired') {
      filter = {
        owner: ownerId,
        $or: [{ status: 'expired' }, { expiresAt: { $lte: now } }],
      };
    }

    const docs = await this.fileModel
      .find(filter)
      .sort({ createdAt: -1 })
      .exec();

    return { items: docs.map((doc) => this.toView(doc)), count: docs.length };
  }

  /** US06 — Supprime définitivement un fichier de l'utilisateur (disque + document). */
  async deleteForUser(ownerId: string, fileId: string): Promise<void> {
    if (!Types.ObjectId.isValid(fileId)) {
      throw new NotFoundException('Fichier introuvable.');
    }

    const file = await this.fileModel.findById(fileId).exec();
    if (!file) {
      throw new NotFoundException('Fichier introuvable.');
    }
    if (file.owner.toString() !== ownerId) {
      throw new ForbiddenException("Ce fichier ne t'appartient pas.");
    }

    await this.storage.remove(file.storageKey);
    await this.fileModel.deleteOne({ _id: file._id }).exec();
  }
}
