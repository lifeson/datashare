import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FileStatus = 'active' | 'expired';
export type StoredFileDocument = HydratedDocument<StoredFile>;

/**
 * Un fichier téléversé. Collection `files`.
 * Cf. MCD étape 1 : entité FICHIER, association DÉPOSER = référence `owner`.
 */
@Schema({ timestamps: true, collection: 'files' })
export class StoredFile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  owner: Types.ObjectId;

  @Prop({ required: true })
  originalName: string;

  /** Nom du fichier sur disque (UUID, sans extension). */
  @Prop({ required: true })
  storageKey: string;

  @Prop({ required: true })
  mimeType: string;

  /** Taille en octets. */
  @Prop({ required: true })
  size: number;

  /** Jeton public non prédictible ; effacé lorsque le fichier devient un tombstone. */
  @Prop({ unique: true, sparse: true })
  downloadToken?: string;

  /** Hash bcrypt du mot de passe de téléchargement, ou null si non protégé. */
  @Prop({ type: String, default: null })
  passwordHash: string | null;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ required: true, min: 1, max: 7 })
  expiresInDays: number;

  @Prop({ required: true, index: true })
  expiresAt: Date;

  @Prop({ default: 0 })
  downloadCount: number;

  @Prop({ type: String, enum: ['active', 'expired'], default: 'active' })
  status: FileStatus;

  /** Horodatage de la suppression physique (tombstone) ; null tant que le fichier existe. */
  @Prop({ type: Date, default: null })
  deletedFileAt: Date | null;

  // Ajoutés au runtime par `timestamps: true`.
  createdAt: Date;
  updatedAt: Date;
}

export const StoredFileSchema = SchemaFactory.createForClass(StoredFile);
